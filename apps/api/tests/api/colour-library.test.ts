import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ColourPreferencesResponse, MyColoursResponse } from '@styleme/contracts';
import { colourLibraryContentSchema, type ColourLibraryContent } from '../../src/colours/content';
import { buildColourLibrary, type ColourLibrary } from '../../src/colours/library';
import { seedColourLibrary } from '../../src/colours/seed';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import shipped from '../../src/style-rules/data/colour-library.json' with { type: 'json' };
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Colour library (D-133, API.md §3.13): Monk tone → undertone → 100+ colours. Each user sees only their own
// category; drafts never reach production; liked and avoided colours are the user's own.

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

/** A signed-in user, optionally with a skin tone (Monk range) and undertone in My Profile. */
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
  const mine = async () =>
    (await request(app).get('/v1/colours/mine').set(bearer(token))).body.data as MyColoursResponse;
  return { app, token, mine };
}

describe('colour library', () => {
  it('seeds 40 categories of 100+ colours and is safe to re-run', async () => {
    const first = await seedColourLibrary(env.db.models, APPROVED, library);
    expect(first).toMatchObject({ categories: 40, colours: library.colours.length, reviewStatus: 'approved' });
    await seedColourLibrary(env.db.models, APPROVED, library);
    const m = env.db.models;
    expect(await m.ColourSwatch.countDocuments()).toBe(library.colours.length);
    expect(await m.ColourCategory.countDocuments()).toBe(40);
    const cat = await m.ColourCategory.findOne({ categoryId: 'monk-06-olive' }).lean();
    expect(cat).toMatchObject({ monkTone: 6, undertone: 'olive', label: 'Monk 6 · Olive', reviewStatus: 'approved' });
    expect(cat!.reviewedBy).toBe('Shreya Sharma');
    expect(cat!.colours.length).toBeGreaterThanOrEqual(100);
  });

  it('shows the user only their own skin tone and undertone', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { mine } = await signedIn('colours-own@example.com', { monkRange: '6-6', undertone: 'warm' });
    const body = await mine();
    expect(body.missing).toBeNull();
    expect(body.category).toMatchObject({
      categoryId: 'monk-06-warm',
      monkTone: 6,
      undertone: 'warm',
      reviewStatus: 'approved',
    });
    expect(body.category!.rationale).toContain('warm undertone');
    expect(body.colours.length).toBeGreaterThanOrEqual(100);
    expect(body.colours.map((c) => c.rank)).toEqual(body.colours.map((_, i) => i + 1));
    expect(body.families.reduce((n, f) => n + f.count, 0)).toBe(body.colours.length);
    expect(body.colours[0]!.reasons.length).toBeGreaterThanOrEqual(2);
    // Exactly that category's colours, nothing from the other 39.
    const own = library.categories.find((c) => c.categoryId === 'monk-06-warm')!;
    expect(body.colours.map((c) => c.colourId)).toEqual(own.colours.map((c) => c.colourId));
  });

  it('has no way to browse other categories', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token } = await signedIn('colours-browse@example.com', { monkRange: '6-6', undertone: 'warm' });
    expect((await request(app).get('/v1/colours/library').set(bearer(token))).status).toBe(404);
    expect((await request(app).get('/v1/colours/categories/monk-02-cool').set(bearer(token))).status).toBe(404);
  });

  it('follows changes to the profile and says what is missing', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token, mine } = await signedIn('colours-tone@example.com');
    expect(await mine()).toMatchObject({ missing: 'skin_tone', category: null, colours: [] });
    const set = (body: object) => request(app).put('/v1/appearance').set(bearer(token)).send(body);
    expect((await set({ skinTone: { value: { monkRange: '7-9' } } })).status).toBe(200);
    expect((await mine()).missing).toBe('undertone');
    expect((await set({ undertone: { value: 'not_sure' } })).status).toBe(200);
    expect((await mine()).missing).toBe('undertone');
    expect((await set({ undertone: { value: 'olive' } })).status).toBe(200);
    expect((await mine()).category?.categoryId).toBe('monk-08-olive'); // middle of 7 – 9
    expect((await set({ useInRecommendations: false })).status).toBe(200);
    expect(await mine()).toMatchObject({ missing: 'signals_off', category: null });
  });

  it('previews a draft outside production but never serves it in production', async () => {
    await seedColourLibrary(env.db.models, DRAFT, library);
    const local = await signedIn('colours-local@example.com', { monkRange: '4-4', undertone: 'cool' });
    expect((await local.mine()).category?.reviewStatus).toBe('draft');

    const prod = await signedIn('colours-prod@example.com', { monkRange: '4-4', undertone: 'cool' }, 'production');
    expect(await prod.mine()).toMatchObject({ missing: 'not_published', category: null, colours: [] });

    await seedColourLibrary(env.db.models, APPROVED, library);
    expect((await prod.mine()).category?.reviewStatus).toBe('approved');
  });

  it('requires sign-in', async () => {
    const { app } = env.makeApp();
    expect((await request(app).get('/v1/colours/mine')).status).toBe(401);
    expect(
      (
        await request(app)
          .put('/v1/colours/preferences')
          .send({ colourIds: ['CLR-0001'], preference: 'liked' })
      ).status,
    ).toBe(401);
  });
});

describe('liked and avoided colours', () => {
  it('saves many colours at once, switches and clears them, per user', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token, mine } = await signedIn('colours-a@example.com', { monkRange: '5-5', undertone: 'neutral' });
    const own = (await mine()).colours.map((c) => c.colourId);
    const [a, b, c, d, e] = own as [string, string, string, string, string];
    const put = (colourIds: string[], preference: string) =>
      request(app).put('/v1/colours/preferences').set(bearer(token)).send({ colourIds, preference });

    expect((await put([a, b, c], 'liked')).status).toBe(200);
    let prefs = (await put([d, e], 'avoided')).body.data as ColourPreferencesResponse;
    expect(prefs.liked.map((x) => x.colourId).sort()).toEqual([a, b, c].sort());
    expect(prefs.avoided.map((x) => x.colourId).sort()).toEqual([d, e].sort());
    expect(prefs.liked[0]).toMatchObject({ name: expect.any(String), hex: expect.any(String), preference: 'liked' });

    // A colour is liked or avoided, never both: the latest choice wins.
    prefs = (await put([a], 'avoided')).body.data as ColourPreferencesResponse;
    expect(prefs.liked.map((x) => x.colourId)).not.toContain(a);
    expect(prefs.avoided[0]!.colourId).toBe(a);
    prefs = (await put([b, d], 'none')).body.data as ColourPreferencesResponse;
    expect(prefs.liked.map((x) => x.colourId)).toEqual([c]);
    expect(prefs.avoided.map((x) => x.colourId).sort()).toEqual([a, e].sort());

    const after = await mine();
    expect(after.saved).toEqual({ liked: 1, avoided: 2 });
    expect(after.colours.find((x) => x.colourId === c)?.preference).toBe('liked');

    // Another user sees nothing of this.
    const other = await signedIn('colours-b@example.com');
    const theirs = (await request(other.app).get('/v1/colours/preferences').set(bearer(other.token))).body
      .data as ColourPreferencesResponse;
    expect(theirs).toEqual({ liked: [], avoided: [], updatedAt: null });
  });

  it('accepts only colours from the user’s own category, or ones already saved', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token, mine } = await signedIn('colours-scope@example.com', { monkRange: '2-2', undertone: 'warm' });
    const own = new Set((await mine()).colours.map((c) => c.colourId));
    const elsewhere = library.colours.find((c) => !own.has(c.colourId))!.colourId;
    const put = (colourIds: string[], preference: string) =>
      request(app).put('/v1/colours/preferences').set(bearer(token)).send({ colourIds, preference });
    expect((await put([elsewhere], 'liked')).status).toBe(400);

    const [first] = [...own];
    expect((await put([first!], 'liked')).status).toBe(200);
    // After a change of undertone the saved colour can still be moved or cleared.
    expect(
      (
        await request(app)
          .put('/v1/appearance')
          .set(bearer(token))
          .send({ undertone: { value: 'cool' } })
      ).status,
    ).toBe(200);
    expect((await put([first!], 'avoided')).status).toBe(200);
    expect((await put([first!], 'none')).status).toBe(200);
  });

  it('rejects unknown colours and malformed requests', async () => {
    await seedColourLibrary(env.db.models, APPROVED, library);
    const { app, token } = await signedIn('colours-bad@example.com', { monkRange: '3-3', undertone: 'olive' });
    const put = (body: object) => request(app).put('/v1/colours/preferences').set(bearer(token)).send(body);
    expect((await put({ colourIds: ['CLR-9999'], preference: 'liked' })).status).toBe(400);
    expect((await put({ colourIds: [], preference: 'liked' })).status).toBe(400);
    expect((await put({ colourIds: ['red'], preference: 'liked' })).status).toBe(400);
    expect((await put({ colourIds: ['CLR-0001'], preference: 'love' })).status).toBe(400);
    expect((await put({ colourIds: ['CLR-0001'], preference: 'liked', extra: 1 })).status).toBe(400);
    const tooMany = Array.from({ length: 201 }, (_, i) => `CLR-${String(i + 1).padStart(4, '0')}`);
    expect((await put({ colourIds: tooMany, preference: 'liked' })).status).toBe(400);
  });

  it('is deleted with the account', () => {
    expect(USER_OWNED_COLLECTIONS).toContain('userColourPreferences');
  });
});
