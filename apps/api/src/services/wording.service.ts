import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import { z } from 'zod';
import {
  CATEGORIES,
  COLORS,
  CONTRAST_LEVELS,
  FABRICS,
  FITS,
  OCCASIONS,
  PATTERNS,
  SILHOUETTES,
  STYLES,
  UNDERTONES,
  type Occasion,
} from '@styleme/contracts';
import { WORDING_PROMPT_VERSION, type WordingPayload } from '../integrations/ai/prompts/v1';
import { WordingProviderError, type WordingFailure, type WordingProvider } from '../integrations/ai/wording-client';
import { findJudgementalLanguage } from '../style-rules/inclusive-language';
import type { GeneratedLook, StyleLibrary } from './engine';
import { SIGNAL_ATTRIBUTES, signalSentences } from './engine/explain';
import { label } from './engine/text';
import type { Models } from '../models/index';

// Optional AI wording of look explanations (FR-LOOK-16, D-67, AI.md §5, #55). Off by default. The
// deterministic engine has already decided everything; this step may only reword the template text
// from the look's references. Only references and public labels are sent: never identity, profile
// free text, appearance signals, sizes, measurements or photos (AI rule 16). Any failure keeps the
// template text and reports AI_ENHANCEMENT_SKIPPED; it never fails the request.

export const DEFAULT_WORDING_TIMEOUT_MS = 4000;
/** Cached wording expires after 7 days (D-13, DATABASE.md §3.5). */
export const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Validated wording by cache key (D-13). A cache failure is a miss; it never fails the request. */
export interface WordingCache {
  get(key: string): Promise<string | null>;
  set(key: string, entry: { provider: string; model: string; text: string }): Promise<void>;
}

/** SHA-256 of request type + model + prompt version + the normalised payload (D-13). */
export function wordingCacheKey(model: string, payload: WordingPayload): string {
  return createHash('sha256')
    .update(JSON.stringify(['explanation-wording', model, payload]))
    .digest('hex');
}

/** The `aiCache` collection (DATABASE.md §3.5): system data, no personal data (AI rule 16). */
export function mongoWordingCache(models: Models, now: () => Date = () => new Date()): WordingCache {
  return {
    async get(key) {
      const entry = await models.AiCache.findOne({ cacheKey: key, expiresAt: { $gt: now() } }).lean();
      const text = (entry?.response as { text?: unknown } | undefined)?.text;
      return typeof text === 'string' ? text : null;
    },
    async set(key, { provider, model, text }) {
      await models.AiCache.updateOne(
        { cacheKey: key },
        {
          $set: {
            provider,
            model,
            requestType: 'explanation-wording',
            response: { text, promptVersion: WORDING_PROMPT_VERSION },
            expiresAt: new Date(now().getTime() + AI_CACHE_TTL_MS),
          },
        },
        { upsert: true },
      );
    },
  };
}

export type WordingSkipCause = WordingFailure | 'unverified_claim' | 'judgemental_language';

export interface WordingOutcome {
  explanation: string;
  /** The provider's model when its text is used, else null. */
  aiModel: string | null;
  aiPromptVersion: string | null;
  /** Why the AI text was not used; null when it was used or when wording is off. */
  skipped: WordingSkipCause | null;
}

const replySchema = z.object({
  text: z.string().trim().min(20).max(800),
  references: z.array(z.string()).max(100),
});

/** Vocabulary the text may mention only when its input does (AI.md §5: no attribute not in the input). */
const CHECKED_LABELS: readonly string[] = [
  ...[COLORS, FABRICS, SILHOUETTES, FITS, STYLES, OCCASIONS, PATTERNS, CATEGORIES].flatMap((list) =>
    list.map((item) => item.label),
  ),
  ...UNDERTONES.filter((u) => u.id !== 'not_sure').map((u) => u.label),
  'skin',
  'undertone',
  'complexion',
  'body',
  'figure',
  'proportion',
  'size',
  'hips',
  'waist',
  'shoulders',
];
const RECORD_ID = /\b(?:STY|FAB|PAL|OUT)-\d{3,}\b/;
const PRODUCT_TEXT = /https?:|www\.|₹|\bRs\.?\s?\d|\bINR\b|\bprice|\bbuy\b|\bshop|\bbrand/i;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text: string, phrase: string) => new RegExp(`\\b${escape(phrase)}\\b`, 'i').test(text);

/**
 * A rule scoped to self-described body proportions applies only because of an appearance signal, so
 * sending it would reveal the signal (AI rule 16). Such rules stay in the template wording.
 */
const isSignalRule = (rule: { appliesTo: { proportions?: readonly string[] } }) =>
  (rule.appliesTo.proportions?.length ?? 0) > 0;

const ATTRIBUTE_LABELS: Record<string, (value: string) => string> = {
  likedColor: (v) => label(COLORS, v),
  'conflict.colors': (v) => label(COLORS, v),
  likedFabric: (v) => label(FABRICS, v),
  'conflict.fabrics': (v) => label(FABRICS, v),
  preferredSilhouette: (v) => label(SILHOUETTES, v),
  preferredFit: (v) => label(FITS, v),
  preferredStyle: (v) => label(STYLES, v),
  contrastPreference: (v) => `${label(CONTRAST_LEVELS, v)} contrast`,
  coverage: (v) => (v === 'sleeve' ? 'sleeve length' : v === 'length' ? 'garment length' : v),
};

export class WordingService {
  /** `provider` is null when AI wording is off (`AI_WORDING_ENABLED=false`, the default). */
  constructor(
    private readonly provider: WordingProvider | null,
    private readonly library: StyleLibrary,
    private readonly logger: Logger,
    private readonly timeoutMs = DEFAULT_WORDING_TIMEOUT_MS,
    private readonly cache: WordingCache | null = null,
  ) {}

  get enabled(): boolean {
    return this.provider !== null;
  }

  /** What would be sent for one look: references and public labels only (public so tests can inspect it). */
  payloadFor(look: GeneratedLook, occasion: Occasion): WordingPayload {
    const template = this.library.findTemplates({ occasion, department: 'any' });
    const rules = look.explanationRefs.ruleIds.flatMap((id) => {
      const rule = this.library.getRule(id);
      return rule && !isSignalRule(rule) ? [{ id, rationale: rule.rationale }] : [];
    });
    const attributes = look.explanationRefs.attributes
      .filter((a) => !['template', 'palette', 'occasion'].includes(a.attribute))
      .filter((a) => !SIGNAL_ATTRIBUTES.includes(a.attribute))
      .map((a) => ({
        ref: `${a.attribute}:${a.value}`,
        attribute: a.attribute,
        label: (ATTRIBUTE_LABELS[a.attribute] ?? ((v: string) => v))(a.value),
      }));
    const payload: Omit<WordingPayload, 'references'> = {
      promptVersion: WORDING_PROMPT_VERSION,
      occasion: label(OCCASIONS, occasion),
      template: { id: look.templateId, name: template.find((t) => t.id === look.templateId)?.name ?? look.templateId },
      palette: { id: look.paletteId, name: this.library.getPalette(look.paletteId)?.name ?? look.paletteId },
      rules,
      attributes,
    };
    const references = [
      `template:${look.templateId}`,
      `palette:${look.paletteId}`,
      `occasion:${occasion}`,
      ...rules.map((r) => r.id),
      ...attributes.map((a) => a.ref),
    ];
    return { ...payload, references: [...new Set(references)] };
  }

  async reword(look: GeneratedLook, occasion: Occasion): Promise<WordingOutcome> {
    const template: WordingOutcome = {
      explanation: look.explanation,
      aiModel: null,
      aiPromptVersion: null,
      skipped: null,
    };
    if (!this.provider) return template;

    const payload = this.payloadFor(look, occasion);
    const key = wordingCacheKey(this.provider.model, payload);
    const cached = await this.cache?.get(key).catch(() => null);
    const result = cached ? { text: cached } : await this.call(this.provider, payload);
    if (!cached && 'text' in result) {
      // Only validated text is cached. A failed write is ignored: the cache is an optimisation.
      await this.cache
        ?.set(key, { provider: this.provider.name, model: this.provider.model, text: result.text })
        .catch(() => this.logger.warn({ event: 'ai_cache_write_failed' }));
    }
    if ('cause' in result) {
      // The cause only: never the payload, the reply or any user data (D-17).
      this.logger.warn({ event: 'ai_wording_skipped', cause: result.cause });
      return { ...template, skipped: result.cause };
    }
    // Signal-scoped rules and signal sentences were never sent, so they are kept exactly as written.
    const kept = [
      ...look.explanationRefs.ruleIds.flatMap((id) => {
        const rule = this.library.getRule(id);
        return rule && isSignalRule(rule) ? [rule.rationale] : [];
      }),
      ...signalSentences(look.explanationRefs.attributes).map((s) => s.text),
    ];
    return {
      explanation: [result.text, ...kept].join(' '),
      aiModel: this.provider.model,
      aiPromptVersion: WORDING_PROMPT_VERSION,
      skipped: null,
    };
  }

  /** The validated text, or why it can't be used. */
  private async call(
    provider: WordingProvider,
    payload: WordingPayload,
  ): Promise<{ text: string } | { cause: WordingSkipCause }> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let raw: unknown;
    try {
      raw = await Promise.race([
        provider.reword(payload, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new WordingProviderError('timeout'));
          }, this.timeoutMs);
        }),
      ]);
    } catch (error) {
      return { cause: error instanceof WordingProviderError ? error.cause : 'provider_error' };
    } finally {
      clearTimeout(timer);
    }

    const parsed = replySchema.safeParse(raw);
    if (!parsed.success) return { cause: 'invalid_output' };
    const { text, references } = parsed.data;
    const expected = new Set(payload.references);
    if (references.length !== expected.size || new Set(references).size !== expected.size)
      return { cause: 'invalid_output' };
    if (references.some((r) => !expected.has(r))) return { cause: 'invalid_output' };

    const corpus = [
      payload.occasion,
      payload.template.name,
      payload.palette.name,
      ...payload.rules.map((r) => r.rationale),
      ...payload.attributes.map((a) => a.label),
    ].join(' \n ');
    if (RECORD_ID.test(text) || PRODUCT_TEXT.test(text)) return { cause: 'unverified_claim' };
    if (CHECKED_LABELS.some((phrase) => mentions(text, phrase) && !mentions(corpus, phrase)))
      return { cause: 'unverified_claim' };
    if (findJudgementalLanguage(text).length > 0) return { cause: 'judgemental_language' };
    return { text };
  }
}
