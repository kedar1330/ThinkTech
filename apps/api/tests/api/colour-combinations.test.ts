import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MyColourCombinationsResponse, MyColoursResponse } from '@styleme/contracts';
import { colourLibraryContentSchema, type ColourLibraryContent } from '../../src/colours/content';
import { buildColourLibrary, type ColourLibrary } from '../../src/colours/library';
import { seedColourLibrary } from '../../src/colours/seed';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import shipped from '../../src/style-rules/data/colour-library.json' with { type: 'json' };
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Coordinating colours and curated combinations (#105, API.md §3.13): only from the user's own category, never
// with an avoided colour, stored per user and rebuilt when their colours change.

const APPROVED = colourLibraryContentSchema.parse(shipped);
const DRAFT: ColourLibraryContent = { ...APPROVED, reviewStatus: 'draft', reviewedBy: null, reviewedAt: null };

let env: TestEnv;
let library: ColourLibrary;
beforeAll(async () => {
  env = await startTestEnv();
  library = buildColourLibrary(APPROVED);
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
});

async function signedIn(
  email: string,
  tone?: { monkRange: string; undertone: string },
  appEnv: 'local' | 'production' = 'local',
) {
  const { app, mail } = env.makeApp({ APP_ENV: appEnv });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  if (tone) {
    const res = await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ skinTone: { value: { monkRange: tone.monkRange } }, undertone: { value: tone.undertone } });
    expect(res.status).toBe(200);
  }
  const combinations = async () =>
    (await request(app).get('/v1/colours/combinations').set(bearer(token))).body.data as MyColourCombinationsResponse;
  const mine = async () =>
    (await request(app).get('/v1/colours/mine').set(bearer(token))).body.data as MyColoursResponse;
  const put = (colourIds: string[], preference: string) =>
    request(app).put('/v1/colours/preferences').set(bearer(token)).send({ colourIds, preference });
  return { app, token, combinations, mine, put };
}

describe('coordinating colours and curated combinations', () => {
  it('builds them from the user’s own colours only, and stores them', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { combinations, mine } = await signedIn('combos-own@example.com', { monkRange: '6-6', undertone: 'warm' });
    const own = new Set((await mine()).colours.map((c) => c.colourId));
    const body = await combinations();

    expect(body.missing).toBeNull();
    expect(body.combinations.length).toBeGreaterThanOrEqual(100);
    expect(body.harmonies.reduce((n, h) => n + h.count, 0)).toBe(body.combinations.length);
    for (const c of body.combinations) {
      expect(c.reason.length).toBeGreaterThan(10);
      for (const col of c.colours) {
        expect(own.has(col.colourId)).toBe(true);
        expect(col).toMatchObject({ name: expect.any(String), hex: expect.stringMatching(/^#[0-9A-F]{6}$/i) });
      }
    }
    expect(body.coordinating).toHaveLength(own.size);
    expect(body.colours).toHaveLength(own.size);

    const stored = await env.db.models.UserColourCombination.find().lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ categoryId: 'monk-06-warm' });
    // Read again: served from the stored copy, not rebuilt.
    expect((await combinations()).generatedAt).toBe(body.generatedAt);
  });

  it('drops avoided colours, marks liked ones, and rebuilds when they change', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { combinations, put } = await signedIn('combos-prefs@example.com', { monkRange: '5-5', undertone: 'cool' });
    const before = await combinations();
    const avoided = before.combinations[0]!.colours[0]!.colourId;
    const liked = before.combinations[1]!.colours.at(-1)!.colourId;
    expect((await put([avoided], 'avoided')).status).toBe(200);
    expect((await put([liked], 'liked')).status).toBe(200);

    const after = await combinations();
    expect(after.generatedAt).not.toBe(before.generatedAt);
    const used = after.combinations.flatMap((c) => c.colours.map((col) => col.colourId));
    expect(used).not.toContain(avoided);
    expect(after.colours.map((c) => c.colourId)).not.toContain(avoided);
    expect(after.coordinating.flatMap((c) => [c.colourId, ...c.matches])).not.toContain(avoided);
    const withLiked = after.combinations.filter((c) => c.colours.some((col) => col.colourId === liked));
    expect(withLiked.length).toBeGreaterThan(0);
    expect(withLiked[0]!.likedCount).toBe(1);
    expect(withLiked[0]!.colours.find((col) => col.colourId === liked)?.preference).toBe('liked');
    expect(await env.db.models.UserColourCombination.countDocuments()).toBe(1);
  });

  it('follows a change of skin tone or undertone, and says what is missing', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token, combinations } = await signedIn('combos-tone@example.com');
    expect(await combinations()).toMatchObject({ missing: 'skin_tone', combinations: [], coordinating: [] });

    const set = (body: object) => request(app).put('/v1/appearance').set(bearer(token)).send(body);
    expect((await set({ skinTone: { value: { monkRange: '2-2' } }, undertone: { value: 'warm' } })).status).toBe(200);
    const warm = await combinations();
    expect(warm.combinations.length).toBeGreaterThan(0);
    expect((await set({ undertone: { value: 'cool' } })).status).toBe(200);
    const cool = await combinations();
    const coolColours = new Set(
      library.categories.find((c) => c.categoryId === 'monk-02-cool')!.colours.map((c) => c.colourId),
    );
    expect(cool.combinations.every((c) => c.colours.every((col) => coolColours.has(col.colourId)))).toBe(true);
    expect((await env.db.models.UserColourCombination.findOne().lean())?.categoryId).toBe('monk-02-cool');

    expect((await set({ useInRecommendations: false })).status).toBe(200);
    expect(await combinations()).toMatchObject({ missing: 'signals_off', combinations: [] });
  });

  it('never serves combinations from a draft category in production', async () => {
    await seedColourLibrary(env.db.models, DRAFT, library);
    const prod = await signedIn('combos-prod@example.com', { monkRange: '4-4', undertone: 'olive' }, 'production');
    expect(await prod.combinations()).toMatchObject({ missing: 'not_published', combinations: [] });
    const local = await signedIn('combos-local@example.com', { monkRange: '4-4', undertone: 'olive' });
    expect((await local.combinations()).combinations.length).toBeGreaterThan(0);
  });

  it('keeps each user’s combinations to themselves', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const a = await signedIn('combos-a@example.com', { monkRange: '8-8', undertone: 'neutral' });
    const b = await signedIn('combos-b@example.com', { monkRange: '8-8', undertone: 'neutral' });
    const first = (await a.combinations()).combinations[0]!.colours[0]!.colourId;
    expect((await a.put([first], 'avoided')).status).toBe(200);
    await a.combinations();
    const theirs = await b.combinations();
    expect(theirs.colours.map((c) => c.colourId)).toContain(first);
    expect(await env.db.models.UserColourCombination.countDocuments()).toBe(2);
  });

  it('requires sign-in', async () => {
    const { app } = env.makeApp();
    expect((await request(app).get('/v1/colours/combinations')).status).toBe(401);
  });

  it('is deleted with the account', () => {
    expect(USER_OWNED_COLLECTIONS).toContain('userColourCombinations');
  });
});
