import type { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { paletteListResponseSchema, recommendationResponseSchema } from '@styleme/contracts';
import { SUGGESTED_LOOK_TTL_MS } from '../../src/services/recommendations.service';
import { loadStyleLibrary } from '../../src/style-rules';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { FakeWordingProvider, type FakeReply } from '../fixtures/wording';
import {
  bearer,
  googleToken,
  invite,
  login,
  logTextForPrivacyChecks,
  registerUser,
  startTestEnv,
  type TestEnv,
} from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
});

const styleLibrary = loadStyleLibrary(buildEngineFixtureLibrary(), { allowFixtures: true });

async function signedIn(email: string, options: { shipped?: boolean } = {}) {
  const { app, mail } = env.makeApp({}, options.shipped ? {} : { styleLibrary });
  await registerUser(app, env, mail, email);
  return { app, token: await login(app, email) };
}

describe('POST /v1/recommendations (FR-LOOK, API.md §3.5)', () => {
  it('requires a signed-in user', async () => {
    const { app } = env.makeApp({}, { styleLibrary });
    const res = await request(app).post('/v1/recommendations').send({ occasion: 'everyday' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid requests with INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('val@example.com');
    for (const body of [
      {},
      { occasion: 'brunch' },
      { occasion: 'everyday', budget: 2000 },
      { occasion: 'everyday', wearType: ['indian', 'indian'] },
      { occasion: 'everyday', paletteMode: 'random' },
    ]) {
      const res = await request(app).post('/v1/recommendations').set(bearer(token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('returns looks in the contract shape and stores each as a suggested outfit that expires in 7 days', async () => {
    const { app, token } = await signedIn('ana@example.com');
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['navy'] })
      .expect(200);

    const before = Date.now();
    const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(res.status).toBe(200);
    const data = recommendationResponseSchema.parse(res.body.data);
    expect(data.looks.length).toBeGreaterThan(0);
    expect(res.body.warnings).toContain('DEFAULTS_APPLIED');
    expect(data.looks.every((l) => l.status === 'suggested' && l.aiModel === null)).toBe(true);

    const user = await env.db.models.User.findOne({ email: 'ana@example.com' }).lean();
    const stored = await env.db.models.Outfit.find({ userId: user!._id }).lean();
    expect(stored.map((o) => String(o._id)).sort()).toEqual(data.looks.map((l) => l.id).sort());
    for (const outfit of stored) {
      expect(outfit.status).toBe('suggested');
      expect(String(outfit.recommendationId)).toBe(data.recommendationId);
      expect(outfit.contentVersion).toBe(styleLibrary.contentVersion);
      expect(outfit.request).toEqual({ occasion: 'everyday', paletteMode: 'suggested' });
      expect(outfit.inputsUsed).toMatchObject({ department: 'women', likedColors: ['navy'], signalsUsed: false });
      const expiry = outfit.expiresAt!.getTime() - before;
      expect(expiry).toBeGreaterThanOrEqual(SUGGESTED_LOOK_TTL_MS);
      expect(expiry).toBeLessThan(SUGGESTED_LOOK_TTL_MS + 60_000);
    }
    const ttl = (await env.db.models.Outfit.collection.indexes()).find((i) => i.key.expiresAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it('T-12 the same request twice gives the same looks', async () => {
    const { app, token } = await signedIn('det@example.com');
    const ask = () => request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'work' });
    const strip = (body: { data: { looks: { id: string }[] } }) => body.data.looks.map(({ id: _id, ...look }) => look);
    expect(strip((await ask()).body)).toEqual(strip((await ask()).body));
  });

  it('keeps each user’s looks separate', async () => {
    const a = await signedIn('a@example.com');
    const b = await signedIn('b@example.com');
    const resA = await request(a.app).post('/v1/recommendations').set(bearer(a.token)).send({ occasion: 'everyday' });
    const resB = await request(b.app).post('/v1/recommendations').set(bearer(b.token)).send({ occasion: 'everyday' });
    const userA = await env.db.models.User.findOne({ email: 'a@example.com' }).lean();
    const userB = await env.db.models.User.findOne({ email: 'b@example.com' }).lean();
    const idsOf = async (userId: Types.ObjectId) =>
      (await env.db.models.Outfit.find({ userId }).lean()).map((o) => String(o._id)).sort();
    expect(await idsOf(userA!._id)).toEqual(resA.body.data.looks.map((l: { id: string }) => l.id).sort());
    expect(await idsOf(userB!._id)).toEqual(resB.body.data.looks.map((l: { id: string }) => l.id).sort());
  });

  it('a request nothing satisfies is a success with no looks and the limit named (FR-LOOK-11)', async () => {
    const { app, token } = await signedIn('few@example.com');
    const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'date' });
    expect(res.status).toBe(200);
    expect(res.body.data.looks).toEqual([]);
    expect(res.body.data.limitedBy).toEqual({ constraint: 'occasion', suggestion: expect.any(String) });
    expect(res.body.warnings).toContain('INSUFFICIENT_MATCHES');
    expect(await env.db.models.Outfit.countDocuments()).toBe(0);
  });

  it('AC5: the default (shipped, founder-approved C0) library serves looks and palettes end to end', async () => {
    const { app, token } = await signedIn('shipped@example.com', { shipped: true });
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
    const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'festive' });
    expect(res.status).toBe(200);
    const data = recommendationResponseSchema.parse(res.body.data);
    expect(data.looks.length).toBeGreaterThan(0);
    expect(data.looks.every((l) => l.templateId === 'OUT-004')).toBe(true);
    expect(await env.db.models.Outfit.countDocuments()).toBe(data.looks.length);

    const palettes = await request(app).get('/v1/style/palettes?view=all').set(bearer(token));
    expect(paletteListResponseSchema.parse(palettes.body.data).palettes).toHaveLength(8);
  });

  it('a Google sign-up must create a password first (withPassword)', async () => {
    const { app } = env.makeApp({}, { styleLibrary });
    await invite(env, 'gp@gmail.com');
    const google = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-33', email: 'gp@gmail.com' }), intent: 'signup', acceptTerms: true });
    const token = google.body.data.accessToken as string;
    const looks = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(looks.body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
    const palettes = await request(app).get('/v1/style/palettes').set(bearer(token));
    expect(palettes.body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
  });

  it('account deletion removes the user’s outfits (USER_OWNED_COLLECTIONS)', async () => {
    const { app, mail } = env.makeApp({}, { styleLibrary });
    await registerUser(app, env, mail, 'gone@example.com');
    const token = await login(app, 'gone@example.com');
    await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' }).expect(200);
    expect(await env.db.models.Outfit.countDocuments()).toBeGreaterThan(0);

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const res = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true });
    expect(res.status).toBe(200);
    expect(await env.db.models.Outfit.countDocuments()).toBe(0);
  });

  it('never logs request or profile values', async () => {
    const { app, token } = await signedIn('logs@example.com');
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['lavender'] });
    await request(app)
      .post('/v1/recommendations')
      .set(bearer(token))
      .send({ occasion: 'festive', style: 'traditional' });
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).not.toMatch(/lavender|festive|traditional|explanation/);
  });
});

// The named engine scenarios end to end (TESTING.md §5, #34). The unit suite in tests/unit/engine covers
// each rule in depth; these confirm the API returns what the engine decided.
describe('POST /v1/recommendations: named scenarios (#34)', () => {
  const recommend = (app: Parameters<typeof request>[0], token: string, body: object) =>
    request(app).post('/v1/recommendations').set(bearer(token)).send(body);
  const colours = (data: {
    looks: { slots: { lookSpec: { colorId: string }; alternatives: { lookSpec: { colorId: string } }[] }[] }[];
  }) =>
    data.looks.flatMap((l) =>
      l.slots.flatMap((s) => [s.lookSpec.colorId, ...s.alternatives.map((a) => a.lookSpec.colorId)]),
    );

  it('T-16 only an occasion: looks, DEFAULTS_APPLIED and the defaults listed', async () => {
    const { app, token } = await signedIn('t16@example.com');
    const res = await recommend(app, token, { occasion: 'everyday' });
    expect(res.status).toBe(200);
    expect(res.body.data.looks.length).toBeGreaterThan(0);
    expect(res.body.data.defaultsApplied).toEqual(['department', 'colors', 'signals', 'sizes', 'style']);
    expect(res.body.warnings).toContain('DEFAULTS_APPLIED');
  });

  it('T-13 / T-17 a disliked colour never appears; liked and disliked is a reported conflict', async () => {
    const { app, token } = await signedIn('t17@example.com');
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['navy'], dislikedColors: ['navy', 'rust'] })
      .expect(200);
    for (const paletteMode of ['suggested', 'explore']) {
      const res = await recommend(app, token, { occasion: 'everyday', paletteMode });
      const data = recommendationResponseSchema.parse(res.body.data);
      expect(data.looks.length).toBeGreaterThan(0);
      expect(colours(data)).not.toContain('navy');
      expect(colours(data)).not.toContain('rust');
      expect(data.conflicts).toEqual([{ field: 'colors', value: 'navy' }]);
      expect(res.body.warnings).toContain('PREFERENCE_CONFLICT');
    }
  });

  it('T-18 a very restrictive request: 200, fewer looks, INSUFFICIENT_MATCHES and the limit named', async () => {
    const { app, token } = await signedIn('t18@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'men' }).expect(200);
    const res = await recommend(app, token, { occasion: 'everyday', wearType: ['indian'] });
    expect(res.status).toBe(200);
    expect(res.body.data.looks.length).toBeGreaterThan(0);
    expect(res.body.data.looks.length).toBeLessThan(5);
    expect(res.body.data.limitedBy).toEqual({ constraint: 'wearType', suggestion: expect.any(String) });
    expect(res.body.warnings).toContain('INSUFFICIENT_MATCHES');
  });

  it('T-10 signals switched off give the same looks as no signals', async () => {
    const { app, token } = await signedIn('t10@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
    const looks = async () =>
      (await recommend(app, token, { occasion: 'everyday', style: 'casual' })).body.data.looks.map(
        ({ id: _id, ...look }: { id: string }) => look,
      );
    const without = await looks();
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ bodyProportions: { value: 'hips_wider_than_shoulders' } })
      .expect(200);
    expect(await looks()).not.toEqual(without);
    await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: false }).expect(200);
    expect(await looks()).toEqual(without);
    const user = await env.db.models.User.findOne({ email: 't10@example.com' }).lean();
    const latest = await env.db.models.Outfit.findOne({ userId: user!._id }).sort({ _id: -1 }).lean();
    expect(latest!.inputsUsed).toMatchObject({ signalsUsed: false });
  });

  it('T-24 the response carries no product, price, retailer, availability or link', async () => {
    const { app, token } = await signedIn('t24@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', budgetPreference: 3000 });
    const res = await recommend(app, token, { occasion: 'everyday', paletteMode: 'explore' });
    expect(res.body.data.looks.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/price|retailer|product|availab|₹|https?:/i);
  });

  it('T-25 with AI wording off, looks are complete with template explanations and aiModel null', async () => {
    const { app, token } = await signedIn('t25@example.com');
    const res = await recommend(app, token, { occasion: 'work' });
    const data = recommendationResponseSchema.parse(res.body.data);
    expect(data.looks.length).toBeGreaterThan(0);
    for (const look of data.looks) {
      expect(look.aiModel).toBeNull();
      expect(look.explanation.length).toBeGreaterThan(0);
      expect(look.explanationRefs.attributes).toContainEqual({ attribute: 'template', value: look.templateId });
    }
    const stored = await env.db.models.Outfit.find().lean();
    expect(stored.every((o) => o.aiModel === null)).toBe(true);
  });

  it('T-27 (AI wording off) no outbound call is made while generating looks', async () => {
    const { app, token } = await signedIn('t27@example.com');
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['navy'] });
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ undertone: { value: 'cool' } });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      expect((await recommend(app, token, { occasion: 'everyday' })).status).toBe(200);
      expect((await request(app).get('/v1/style/palettes').set(bearer(token))).status).toBe(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

// Optional AI wording end to end (#55, FR-LOOK-16) with a fake provider (D-39: no key, no network).
describe('POST /v1/recommendations: optional AI wording (T-25 … T-27)', () => {
  const AI_ON = {
    AI_WORDING_ENABLED: true,
    GEMINI_API_KEY: 'unused',
    GEMINI_MODEL: 'unused',
    AI_WORDING_TIMEOUT_MS: 500,
  };

  async function withWording(email: string, reply: FakeReply, enabled = true) {
    const wording = new FakeWordingProvider(reply);
    const { app, mail } = env.makeApp(enabled ? AI_ON : {}, { styleLibrary, wording });
    await registerUser(app, env, mail, email);
    const token = await login(app, email);
    return { app, token, wording };
  }
  const ask = (app: Parameters<typeof request>[0], token: string) =>
    request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
  const explanations = (body: { data: { looks: { explanation: string }[] } }) =>
    body.data.looks.map((l) => l.explanation);

  it('T-25 a provider configured while AI_WORDING_ENABLED is false is never called', async () => {
    const { app, token, wording } = await withWording('t25off@example.com', { kind: 'ok' }, false);
    const res = await ask(app, token);
    expect(res.status).toBe(200);
    expect(wording.payloads).toEqual([]);
    expect(res.body.warnings ?? []).not.toContain('AI_ENHANCEMENT_SKIPPED');
    expect(res.body.data.looks.every((l: { aiModel: unknown }) => l.aiModel === null)).toBe(true);
  });

  it('a valid rewording is used: aiModel and the prompt version are stored; references are unchanged', async () => {
    const off = await withWording('aion-off@example.com', { kind: 'ok' }, false);
    const expected = (await ask(off.app, off.token)).body.data.looks;
    const { app, token, wording } = await withWording('aion@example.com', { kind: 'ok' });
    const res = await ask(app, token);
    const data = recommendationResponseSchema.parse(res.body.data);
    expect(wording.payloads.length).toBe(data.looks.length);
    expect(res.body.warnings ?? []).not.toContain('AI_ENHANCEMENT_SKIPPED');
    for (const [i, look] of data.looks.entries()) {
      expect(look.aiModel).toBe('fake-wording-model');
      expect(look.explanationRefs).toEqual(expected[i].explanationRefs);
      expect(look.combinationSignature).toBe(expected[i].combinationSignature);
    }
    const user = await env.db.models.User.findOne({ email: 'aion@example.com' }).lean();
    const stored = await env.db.models.Outfit.find({ userId: user!._id }).lean();
    expect(stored.length).toBe(data.looks.length);
    expect(stored.every((o) => o.aiModel === 'fake-wording-model' && o.aiPromptVersion === 'wording-v1')).toBe(true);
  });

  const failures: [string, FakeReply][] = [
    ['times out', { kind: 'hang' }],
    ['rate-limits', { kind: 'fail', cause: 'rate_limited' }],
    ['errors', { kind: 'fail', cause: 'provider_error' }],
    ['returns invalid output', { kind: 'reply', body: () => ({ text: 42 }) }],
  ];
  for (const [name, reply] of failures) {
    it(`T-26 provider ${name}: 200, template explanations, aiModel null, AI_ENHANCEMENT_SKIPPED`, async () => {
      const slug = name.replace(/ /g, '-');
      const off = await withWording(`off-${slug}@example.com`, { kind: 'ok' }, false);
      const expected = explanations((await ask(off.app, off.token)).body);
      const { app, token } = await withWording(`t26-${slug}@example.com`, reply);
      const res = await ask(app, token);
      expect(res.status).toBe(200);
      expect(res.body.warnings).toContain('AI_ENHANCEMENT_SKIPPED');
      expect(explanations(res.body)).toEqual(expected);
      expect(res.body.data.looks.every((l: { aiModel: unknown }) => l.aiModel === null)).toBe(true);
      expect(await env.db.models.Outfit.countDocuments({ aiModel: { $ne: null } })).toBe(0);
      // The cause is logged without personal data or text.
      const logs = logTextForPrivacyChecks(env.logLines);
      expect(logs).toContain('ai_wording_skipped');
      expect(logs).not.toMatch(/explanation|rationale|Fixture/i);
    });
  }

  it('aiCache (D-13): repeated looks reuse validated wording; entries expire in 7 days and hold no personal data', async () => {
    const { app, token, wording } = await withWording('cache@example.com', { kind: 'ok' });
    const first = await ask(app, token);
    const calls = wording.payloads.length;
    expect(calls).toBe(first.body.data.looks.length);
    const again = await ask(app, token);
    expect(wording.payloads.length).toBe(calls);
    expect(explanations(again.body)).toEqual(explanations(first.body));
    const entries = await env.db.models.AiCache.find().lean();
    expect(entries.length).toBe(calls);
    const user = await env.db.models.User.findOne({ email: 'cache@example.com' }).lean();
    for (const entry of entries) {
      expect(entry).toMatchObject({
        provider: 'fake',
        model: 'fake-wording-model',
        requestType: 'explanation-wording',
      });
      expect(entry.cacheKey).toMatch(/^[0-9a-f]{64}$/);
      const ttl = entry.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(7 * 24 * 3600 * 1000 - 60_000);
      expect(ttl).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);
      expect(JSON.stringify(entry)).not.toContain(String(user!._id));
      expect(JSON.stringify(entry)).not.toContain('cache@example.com');
    }
    const ttlIndex = (await env.db.models.AiCache.collection.indexes()).find((i) => i.key.expiresAt === 1);
    expect(ttlIndex?.expireAfterSeconds).toBe(0);
  });

  it('T-27 the outbound payload holds only references and attribute tags: no identity, signals, sizes or budget', async () => {
    const { app, token, wording } = await withWording('t27on@example.com', { kind: 'ok' });
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({
        department: 'women',
        likedColors: ['lavender'],
        budgetPreference: 4321,
        sizes: { ethnicTops: { letter: 'M' }, shoes: { uk: 6 }, bottoms: { waistIn: 31 } },
      })
      .expect(200);
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({
        undertone: { value: 'cool' },
        skinTone: { value: { monkRange: '3-4' } },
        bodyProportions: { value: 'hips_wider_than_shoulders' },
      })
      .expect(200);
    const res = await request(app)
      .post('/v1/recommendations')
      .set(bearer(token))
      .send({ occasion: 'everyday', style: 'casual' });
    expect(res.status).toBe(200);
    expect(wording.payloads.length).toBeGreaterThan(0);
    const user = await env.db.models.User.findOne({ email: 't27on@example.com' }).lean();
    const sent = JSON.stringify(wording.payloads);
    for (const value of [
      't27on',
      'example.com',
      String(user!._id),
      '4321',
      '"M"',
      'waist',
      '31',
      '"cool"', // the undertone value (the fixture palette's name, "Fixture cool", is library content)
      '3-4',
      'hips',
      'undertone',
      'skin',
      'STY-003',
    ]) {
      expect(sent, value).not.toContain(value);
    }
    // The signals still shape the user's own explanation, as template text that never left the API.
    const text = res.body.data.looks.map((l: { explanation: string }) => l.explanation).join(' ');
    expect(text).toContain('from the details you shared');
  });
});

describe('GET /v1/style/palettes (FR-PAL-01 … 03, API.md §3.4)', () => {
  it('requires a signed-in user and a valid view', async () => {
    const { app, token } = await signedIn('pal@example.com');
    expect((await request(app).get('/v1/style/palettes')).status).toBe(401);
    for (const query of ['view=popular', 'view=all&sort=name']) {
      const res = await request(app).get(`/v1/style/palettes?${query}`).set(bearer(token));
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('view=all lists every approved palette with nothing suggested', async () => {
    const { app, token } = await signedIn('all@example.com');
    const res = await request(app).get('/v1/style/palettes?view=all').set(bearer(token));
    expect(res.status).toBe(200);
    const { palettes } = paletteListResponseSchema.parse(res.body.data);
    expect(palettes.map((p) => p.id)).toEqual(['PAL-001', 'PAL-002', 'PAL-003']);
    expect(palettes.every((p) => p.suggestedBecause.length === 0)).toBe(true);
  });

  it('suggested (the default) uses the undertone only while signals are on', async () => {
    const { app, token } = await signedIn('tone@example.com');
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['emerald'] });
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ undertone: { value: 'cool' } });

    const on = await request(app).get('/v1/style/palettes').set(bearer(token));
    expect(on.body.data.palettes[0]).toMatchObject({ id: 'PAL-002', suggestedBecause: ['undertone'] });

    await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: false });
    const off = await request(app).get('/v1/style/palettes').set(bearer(token));
    expect(off.body.data.palettes[0]).toMatchObject({ id: 'PAL-003', suggestedBecause: ['likedColors'] });
    expect(JSON.stringify(off.body.data)).not.toContain('undertone');
  });
});
