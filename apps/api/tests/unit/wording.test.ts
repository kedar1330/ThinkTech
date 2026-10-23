import { describe, expect, it, vi } from 'vitest';
import { BASE_CONFIG, withoutDotenvFiles } from '../helpers';
import { loadConfig } from '../../src/config/env';
import { buildWordingPrompt, WORDING_PROMPT_VERSION } from '../../src/integrations/ai/prompts/v1';
import { geminiWordingProvider, WordingProviderError } from '../../src/integrations/ai/wording-client';
import { createLogger } from '../../src/logger';
import type { GeneratedLook } from '../../src/services/engine';
import { WordingService, wordingCacheKey, type WordingCache } from '../../src/services/wording.service';
import { FakeWordingProvider, faithfulReply, type FakeReply } from '../fixtures/wording';
import { library, run } from './engine/helpers';

// Optional AI wording (#55, FR-LOOK-16, AI.md §5) with a fake provider: off by default; only
// references are sent; every failure keeps the template text and reports why (T-25 … T-27).

const SIGNALS = { undertone: 'cool', skinTone: '3-4', bodyProportions: 'hips_wider_than_shoulders' } as const;

/** A look with liked colours, rules and both kinds of signal sentence. */
function sampleLook(): GeneratedLook {
  const result = run({ occasion: 'everyday', style: 'casual' }, { likedColors: ['lavender'] }, SIGNALS);
  const look = result.looks.find((l) => l.explanationRefs.attributes.some((a) => a.attribute === 'undertone'));
  return look ?? result.looks[0]!;
}

function setup(reply?: FakeReply, enabled = true, timeoutMs = 200, cache: WordingCache | null = null) {
  const lines: string[] = [];
  const logger = createLogger({ write: (line: string) => void lines.push(line) });
  const provider = new FakeWordingProvider(reply);
  const service = new WordingService(enabled ? provider : null, library, logger, timeoutMs, cache);
  return { provider, service, lines };
}

/** An in-memory cache that can be made to fail. */
function memoryCache(failing = false) {
  const entries = new Map<string, { provider: string; model: string; text: string }>();
  const cache: WordingCache = {
    async get(key) {
      if (failing) throw new Error('cache down');
      return entries.get(key)?.text ?? null;
    },
    async set(key, entry) {
      if (failing) throw new Error('cache down');
      entries.set(key, entry);
    },
  };
  return { cache, entries };
}

describe('T-25 AI wording off (the default)', () => {
  it('T-25 off by default in config, and the key and model are needed only when it is on', () =>
    withoutDotenvFiles(() => {
      const env = {
        APP_ENV: 'local',
        MONGODB_URI: 'mongodb://x',
        TOMBSTONE_STORE_URI: 'mongodb://y',
        TOMBSTONE_HMAC_KEY: BASE_CONFIG.TOMBSTONE_HMAC_KEY,
        AUTH_ACCESS_TOKEN_SECRET: BASE_CONFIG.AUTH_ACCESS_TOKEN_SECRET,
        BFF_SHARED_SECRET: BASE_CONFIG.BFF_SHARED_SECRET,
        WEB_ORIGIN: 'http://localhost:3000',
      };
      expect(loadConfig(env)).toMatchObject({ AI_WORDING_ENABLED: false, AI_WORDING_TIMEOUT_MS: 4000 });
      expect(() => loadConfig({ ...env, AI_WORDING_ENABLED: 'true' })).toThrow(/GEMINI_API_KEY, GEMINI_MODEL/);
      expect(() => loadConfig({ ...env, AI_WORDING_ENABLED: 'true', GEMINI_API_KEY: 'secret-value' })).not.toThrow(
        /secret-value/,
      );
      const on = loadConfig({ ...env, AI_WORDING_ENABLED: 'true', GEMINI_API_KEY: 'k', GEMINI_MODEL: 'm' });
      expect(on.AI_WORDING_ENABLED).toBe(true);
    }));

  it('T-25 with wording off, the provider is never called and the template text is kept', async () => {
    const { provider, service } = setup({ kind: 'ok' }, false);
    const look = sampleLook();
    expect(service.enabled).toBe(false);
    expect(await service.reword(look, 'everyday')).toEqual({
      explanation: look.explanation,
      aiModel: null,
      aiPromptVersion: null,
      skipped: null,
    });
    expect(provider.payloads).toEqual([]);
  });
});

describe('AI wording on: a valid rewording is used', () => {
  it('uses the reworded text, records the model and prompt version, and keeps signal sentences as written', async () => {
    const { service } = setup({ kind: 'ok' });
    const look = sampleLook();
    const outcome = await service.reword(look, 'everyday');
    expect(outcome.skipped).toBeNull();
    expect(outcome.aiModel).toBe('fake-wording-model');
    expect(outcome.aiPromptVersion).toBe(WORDING_PROMPT_VERSION);
    expect(outcome.explanation).not.toBe(look.explanation);
    expect(outcome.explanation).toContain('which you like');
    expect(outcome.explanation).toContain(
      'The palette is one suggested for a cool undertone, from the details you shared.',
    );
    // The signal-scoped rule is kept as approved text, not reworded.
    expect(outcome.explanation).toContain(library.getRule('STY-003')!.rationale);
  });
});

describe('T-26 every failure keeps the template text with a cause (AI_ENHANCEMENT_SKIPPED)', () => {
  const look = sampleLook();
  const cases: [string, FakeReply, string][] = [
    ['times out', { kind: 'hang' }, 'timeout'],
    ['rate-limits', { kind: 'fail', cause: 'rate_limited' }, 'rate_limited'],
    ['errors', { kind: 'fail', cause: 'provider_error' }, 'provider_error'],
    ['returns no JSON object', { kind: 'reply', body: () => 'plain text' }, 'invalid_output'],
    [
      'returns too short a text',
      { kind: 'reply', body: (p) => ({ text: 'Nice.', references: p.references }) },
      'invalid_output',
    ],
    [
      'leaves out a reference',
      { kind: 'reply', body: (p) => ({ ...faithfulReply(p), references: p.references.slice(1) }) },
      'invalid_output',
    ],
    [
      'invents a reference',
      { kind: 'reply', body: (p) => ({ ...faithfulReply(p), references: [...p.references.slice(1), 'STY-999'] }) },
      'invalid_output',
    ],
    [
      'mentions a colour that is not in its input',
      { kind: 'reply', body: (p) => ({ ...faithfulReply(p), text: `${faithfulReply(p).text} Add a mustard scarf.` }) },
      'unverified_claim',
    ],
    [
      'mentions the undertone it was never sent',
      {
        kind: 'reply',
        body: (p) => ({ ...faithfulReply(p), text: `${faithfulReply(p).text} Great for a cool undertone.` }),
      },
      'unverified_claim',
    ],
    [
      'adds a link or price',
      {
        kind: 'reply',
        body: (p) => ({ ...faithfulReply(p), text: `${faithfulReply(p).text} Buy it at https://x.example.` }),
      },
      'unverified_claim',
    ],
    [
      'shows a record ID',
      { kind: 'reply', body: (p) => ({ ...faithfulReply(p), text: `${faithfulReply(p).text} See rule STY-002.` }) },
      'unverified_claim',
    ],
    [
      'fails the inclusive-language check',
      { kind: 'reply', body: (p) => ({ ...faithfulReply(p), text: `${faithfulReply(p).text} It avoids any flaws.` }) },
      'judgemental_language',
    ],
  ];

  for (const [name, reply, cause] of cases) {
    it(`T-26 provider ${name} → template text, aiModel null, cause ${cause}`, async () => {
      const { service, lines } = setup(reply, true, 100);
      const outcome = await service.reword(look, 'everyday');
      expect(outcome).toEqual({ explanation: look.explanation, aiModel: null, aiPromptVersion: null, skipped: cause });
      // The cause is logged, never the payload or the reply.
      const log = lines.join('\n');
      expect(log).toContain('ai_wording_skipped');
      expect(log).toContain(cause);
      expect(log).not.toMatch(/lavender|undertone"|rationale|Fixture/i);
    });
  }

  it('T-26 a provider that throws something unexpected is a provider error', async () => {
    const { service } = setup({
      kind: 'reply',
      body: () => {
        throw new TypeError('boom');
      },
    });
    expect((await service.reword(look, 'everyday')).skipped).toBe('provider_error');
  });
});

describe('T-27 only references and attribute tags are sent', () => {
  it('T-27 the payload holds the template, palette, occasion, rule rationales and attribute labels only', async () => {
    const { provider, service } = setup({ kind: 'ok' });
    const look = sampleLook();
    await service.reword(look, 'everyday');
    const [payload] = provider.payloads;
    expect(Object.keys(payload!).sort()).toEqual(
      ['attributes', 'occasion', 'palette', 'promptVersion', 'references', 'rules', 'template'].sort(),
    );
    expect(payload!.template.id).toBe(look.templateId);
    // No appearance signal, in any form: not the attribute, its value, the explanation's sentence or a
    // rule that applies only because of one (STY-003 is scoped to self-described proportions).
    expect(look.explanationRefs.attributes.some((a) => a.attribute === 'undertone')).toBe(true);
    expect(look.explanationRefs.ruleIds).toContain('STY-003');
    expect(payload!.rules.map((r) => r.id)).toEqual(look.explanationRefs.ruleIds.filter((id) => id !== 'STY-003'));
    const sent = JSON.stringify(payload);
    expect(sent).not.toMatch(/undertone|skinTone|skin|hips|proportion|2-4|3-4|from the details you shared|STY-003/i);
    expect(sent).not.toContain(library.getRule('STY-003')!.rationale);
    expect(sent).not.toMatch(/"cool"/i);
    // No identity, sizes or measurements: the payload has no field that could carry them.
    expect(sent).not.toMatch(/userId|email|sizes|waist|"uk"|budget|measurement|@/i);
    // What leaves the API is fixed instructions plus exactly this payload.
    expect(buildWordingPrompt(payload!).endsWith(`\n${sent}`)).toBe(true);
  });
});

describe('Gemini client (real provider, exercised with a stubbed fetch; D-39)', () => {
  const payload = () => setup().service.payloadFor(sampleLook(), 'everyday');
  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

  it('sends the versioned prompt with the key in a header, and parses the JSON reply', async () => {
    const fetchImpl = reply(200, {
      candidates: [{ content: { parts: [{ text: JSON.stringify({ text: 'hello', references: [] }) }] } }],
    });
    const provider = geminiWordingProvider('the-key', 'model-x', fetchImpl as unknown as typeof fetch);
    const p = payload();
    expect(await provider.reword(p, new AbortController().signal)).toEqual({ text: 'hello', references: [] });
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/model-x:generateContent');
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'the-key' });
    expect(url).not.toContain('the-key');
    const body = JSON.parse(String(init.body));
    expect(body.contents[0].parts[0].text).toBe(buildWordingPrompt(p));
  });

  it('maps 429 to rate_limited, other errors to provider_error and unreadable replies to invalid_output', async () => {
    const cause = async (fetchImpl: unknown, signal = new AbortController().signal) => {
      try {
        await geminiWordingProvider('k', 'm', fetchImpl as typeof fetch).reword(payload(), signal);
        return 'none';
      } catch (error) {
        return (error as WordingProviderError).cause;
      }
    };
    expect(await cause(reply(429, {}))).toBe('rate_limited');
    expect(await cause(reply(500, {}))).toBe('provider_error');
    expect(await cause(reply(200, { candidates: [] }))).toBe('invalid_output');
    expect(await cause(reply(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }))).toBe(
      'invalid_output',
    );
    expect(
      await cause(
        vi.fn(async () => {
          throw new Error('network');
        }),
      ),
    ).toBe('provider_error');
    const aborted = new AbortController();
    aborted.abort();
    expect(
      await cause(
        vi.fn(async () => {
          throw new Error('aborted');
        }),
        aborted.signal,
      ),
    ).toBe('timeout');
  });
});

describe('aiCache (D-13): validated wording is reused, failures are not cached', () => {
  it('a second identical look uses the cache and makes no provider call', async () => {
    const { cache, entries } = memoryCache();
    const { provider, service } = setup({ kind: 'ok' }, true, 200, cache);
    const look = sampleLook();
    const first = await service.reword(look, 'everyday');
    const second = await service.reword(look, 'everyday');
    expect(provider.payloads.length).toBe(1);
    expect(second).toEqual(first);
    const [key] = entries.keys();
    expect(key).toBe(wordingCacheKey('fake-wording-model', service.payloadFor(look, 'everyday')));
    expect(entries.get(key!)).toMatchObject({ provider: 'fake', model: 'fake-wording-model' });
  });

  it('the key changes with the model and the payload', () => {
    const { service } = setup();
    const payload = service.payloadFor(sampleLook(), 'everyday');
    expect(wordingCacheKey('m1', payload)).not.toBe(wordingCacheKey('m2', payload));
    expect(wordingCacheKey('m1', payload)).not.toBe(wordingCacheKey('m1', { ...payload, occasion: 'Work' }));
  });

  it('a rejected or failed wording is never cached', async () => {
    const { cache, entries } = memoryCache();
    const { service } = setup({ kind: 'fail', cause: 'provider_error' }, true, 200, cache);
    expect((await service.reword(sampleLook(), 'everyday')).skipped).toBe('provider_error');
    expect(entries.size).toBe(0);
  });

  it('a failing cache is a miss: the wording still works and the request never fails', async () => {
    const { cache } = memoryCache(true);
    const { provider, service, lines } = setup({ kind: 'ok' }, true, 200, cache);
    const outcome = await service.reword(sampleLook(), 'everyday');
    expect(outcome.aiModel).toBe('fake-wording-model');
    expect(provider.payloads.length).toBe(1);
    expect(lines.join(' ')).toContain('ai_cache_write_failed');
  });
});
