import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  TRY_ON_NOTICE_VERSION,
  lookProductMatchesSchema,
  lookSchema,
  tryOnJobSchema,
  tryOnOverviewSchema,
  type Look,
  type TryOnJob,
} from '@styleme/contracts';
import { createRateLimits } from '../../src/middleware/rate-limit';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeShoppingProvider } from '../fixtures/shopping';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { FakeTryOnRenderer, SYNTHETIC_GLB } from '../fixtures/try-on';
import { SYNTHETIC_JPEG } from '../fixtures/vision';
import {
  bearer,
  login,
  logTextForPrivacyChecks,
  registerUser,
  startTestEnv,
  type AppOptions,
  type TestEnv,
} from '../helpers';

// 3D Virtual Try-On (#106, D-137): the user's try-on photo + a similar item's thumbnail → fal.ai (fake) →
// dressed picture → 3D model, advanced by polls and stored privately for a day.

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
const GARMENTS = new Set(['layer', 'one_piece', 'top', 'bottom']);

async function signedIn(
  email: string,
  renderer: FakeTryOnRenderer | null = new FakeTryOnRenderer(),
  overrides = {},
  options: AppOptions = {},
) {
  const { app, mail } = env.makeApp(overrides, {
    styleLibrary,
    shopping: new FakeShoppingProvider(),
    ...(renderer ? { tryOn: renderer } : {}),
    ...options,
  });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
  return { app, mail, token, renderer: renderer! };
}

async function withPhoto(app: Express, token: string) {
  await request(app)
    .post('/v1/photos/try-on')
    .set(bearer(token))
    .set('content-type', 'image/jpeg')
    .send(SYNTHETIC_JPEG)
    .expect(201);
}

async function firstLook(app: Express, token: string): Promise<Look> {
  const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
  expect(res.status).toBe(200);
  return lookSchema.parse(res.body.data.looks[0]);
}

const start = (app: Express, token: string, body: Record<string, unknown>) =>
  request(app)
    .post('/v1/try-on/jobs')
    .set(bearer(token))
    .send({ notice: TRY_ON_NOTICE_VERSION, ...body });

async function poll(app: Express, token: string, id: string): Promise<TryOnJob> {
  const res = await request(app).get(`/v1/try-on/jobs/${id}`).set(bearer(token));
  expect(res.status).toBe(200);
  return tryOnJobSchema.parse(res.body.data);
}

/** Polls until the try-on stops changing stage (done or failed), at most `max` times. */
async function finish(app: Express, token: string, id: string, max = 20): Promise<TryOnJob> {
  let job = await poll(app, token, id);
  for (let i = 0; i < max && (job.stage === 'try_on' || job.stage === 'model_3d'); i++)
    job = await poll(app, token, id);
  return job;
}

/** One similar item for the look's first garment, as Shop My Look shows it. */
async function firstItem(app: Express, token: string, look: Look) {
  const res = await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token)).expect(200);
  const products = lookProductMatchesSchema.parse(res.body.data);
  const slot = products.slots[0]!;
  const listing = slot.listings[0]!;
  return { slotId: slot.slotId, listing, item: { store: listing.store, title: listing.title, price: listing.price } };
}

describe('/v1/try-on (D-137)', () => {
  it('every endpoint requires a signed-in user', async () => {
    const { app } = env.makeApp();
    const id = 'a'.repeat(24);
    for (const res of [
      await request(app).get('/v1/try-on'),
      await request(app).post('/v1/try-on/jobs').send({}),
      await request(app).get(`/v1/try-on/jobs/${id}`),
      await request(app).get(`/v1/try-on/jobs/${id}/image`),
      await request(app).get(`/v1/try-on/jobs/${id}/model`),
      await request(app).delete(`/v1/try-on/jobs/${id}`),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it('says whether try-on is available, which model the user chose and whether a photo is stored', async () => {
    const { app, token } = await signedIn('overview@example.com');
    const before = tryOnOverviewSchema.parse((await request(app).get('/v1/try-on').set(bearer(token))).body.data);
    // No image editor in these tests, so the cartoon drape (D-138) is off.
    expect(before).toEqual({ available: true, drapeAvailable: false, tryOnModel: 'dummy_model', hasPhoto: false });
    await withPhoto(app, token);
    const after = tryOnOverviewSchema.parse((await request(app).get('/v1/try-on').set(bearer(token))).body.data);
    expect(after).toEqual({ available: true, drapeAvailable: false, tryOnModel: 'custom_photo', hasPhoto: true });

    const off = await signedIn('off@example.com', new FakeTryOnRenderer(), { TRY_ON_ENABLED: false });
    expect((await request(off.app).get('/v1/try-on').set(bearer(off.token))).body.data.available).toBe(false);
  });

  it('validates the request: the notice must be agreed, and an item needs its garment', async () => {
    // Without the start limit (3 a minute), so every case reaches validation.
    const { app, token } = await signedIn(
      'valid@example.com',
      undefined,
      {},
      {
        rateLimits: { ...createRateLimits(), tryOn: [] },
      },
    );
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    expect((await start(app, token, { outfitId: look.id, notice: 'old' })).status).toBe(400);
    expect((await request(app).post('/v1/try-on/jobs').set(bearer(token)).send({ outfitId: look.id })).status).toBe(
      400,
    );
    expect(
      (await start(app, token, { outfitId: look.id, item: { store: 'amazon', title: 'x', price: 1 } })).status,
    ).toBe(400);
    expect((await start(app, token, { outfitId: 'not-an-id' })).status).toBe(400);
  });

  it('needs a stored photo, and the user’s choice of their photo over the dummy model', async () => {
    const { app, token, renderer } = await signedIn('photo@example.com');
    const look = await firstLook(app, token);
    const none = await start(app, token, { outfitId: look.id });
    expect(none.status).toBe(409);
    expect(none.body.error.message).toMatch(/full-body photo in My Profile/);

    await withPhoto(app, token);
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', tryOnModel: 'dummy_model' })
      .expect(200);
    const dummy = await start(app, token, { outfitId: look.id });
    expect(dummy.status).toBe(409);
    expect(dummy.body.error.message).toMatch(/dummy model isn’t available yet/);
    expect(renderer.tryOns).toHaveLength(0);
  });

  it('is off without a provider', async () => {
    const { app, token } = await signedIn('none@example.com', null);
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const res = await start(app, token, { outfitId: look.id });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('tries one similar item on the photo, then builds the 3D model; both are stored for their owner', async () => {
    const { app, token, renderer } = await signedIn('item@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const { slotId, listing, item } = await firstItem(app, token, look);

    const res = await start(app, token, { outfitId: look.id, slotId, item });
    expect(res.status).toBe(202);
    const job = tryOnJobSchema.parse(res.body.data);
    expect(job).toMatchObject({ stage: 'try_on', step: 1, totalSteps: 1, imageReady: false, model3d: 'pending' });
    // The listing as the search returned it; what it matched on (#133) is not part of the garment.
    const { store, title, price, link, imageUrl } = listing;
    expect(job.garments).toEqual([{ store, title, price, link, imageUrl, slotId }]);

    // Only the photo (as a data URI) and the store's thumbnail are sent.
    expect(renderer.tryOns).toEqual([
      {
        person: `data:image/jpeg;base64,${SYNTHETIC_JPEG.toString('base64')}`,
        garmentImageUrl: listing.imageUrl,
        category: expect.stringMatching(/^(tops|bottoms|one-pieces)$/),
      },
    ]);

    expect((await poll(app, token, job.id)).stage).toBe('try_on');
    const pictured = await poll(app, token, job.id);
    expect(pictured).toMatchObject({ stage: 'model_3d', imageReady: true, model3d: 'pending' });
    // The 3D model is built from the dressed picture.
    expect(renderer.models).toEqual(['https://cdn.example.test/tryon-1-1.jpg']);
    const image = await request(app).get(`/v1/try-on/jobs/${job.id}/image`).set(bearer(token));
    expect(image.status).toBe(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(image.body as Buffer)).toEqual(SYNTHETIC_JPEG);
    expect((await request(app).get(`/v1/try-on/jobs/${job.id}/model`).set(bearer(token))).status).toBe(404);

    const done = await finish(app, token, job.id);
    expect(done).toMatchObject({ stage: 'done', imageReady: true, model3d: 'ready', message: null });
    const model = await request(app)
      .get(`/v1/try-on/jobs/${job.id}/model`)
      .set(bearer(token))
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(model.status).toBe(200);
    expect(model.headers['content-type']).toBe('model/gltf-binary');
    expect(model.body).toEqual(SYNTHETIC_GLB);

    // fal's result URL is not kept once the try-on has ended.
    const stored = await env.db.models.TryOnJob.findById(job.id).select('+resultUrl').lean();
    expect(stored?.resultUrl).toBeNull();
    expect(stored?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it('tries a whole look on garment by garment, layered bottom-up, each on the last result', async () => {
    const { app, token, renderer } = await signedIn('look@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const garments = look.slots.filter((s) => GARMENTS.has(s.slot));

    const res = await start(app, token, { outfitId: look.id });
    expect(res.status).toBe(202);
    const job = tryOnJobSchema.parse(res.body.data);
    expect(job.totalSteps).toBe(Math.min(garments.length, 3));
    const done = await finish(app, token, job.id);
    expect(done).toMatchObject({ stage: 'done', model3d: 'ready' });

    expect(renderer.tryOns).toHaveLength(job.totalSteps);
    expect(renderer.tryOns[0]!.person).toMatch(/^data:image\/jpeg;base64,/);
    for (let i = 1; i < renderer.tryOns.length; i++) {
      expect(renderer.tryOns[i]!.person).toMatch(/^https:\/\/cdn\.example\.test\/tryon-/);
    }
    const order = { 'one-pieces': 0, bottoms: 1, tops: 2 } as const;
    const categories = renderer.tryOns.map((t) => order[t.category]);
    expect(categories).toEqual([...categories].sort());
    expect(renderer.models).toHaveLength(1);
  });

  it('reuses a kept try-on of the same photo and garments instead of paying for it again', async () => {
    const { app, token, renderer } = await signedIn('cache@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const { slotId, item } = await firstItem(app, token, look);
    const first = await start(app, token, { outfitId: look.id, slotId, item });
    const again = await start(app, token, { outfitId: look.id, slotId, item });
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(renderer.tryOns).toHaveLength(1);
  });

  it('keeps the picture when the 3D model fails, and says why when the try-on fails', async () => {
    const renderer = new FakeTryOnRenderer();
    renderer.failResult = { kind: '3d', cause: 'provider_error' };
    const { app, token } = await signedIn('fail3d@example.com', renderer);
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const { slotId, item } = await firstItem(app, token, look);
    const job = (await start(app, token, { outfitId: look.id, slotId, item })).body.data as TryOnJob;
    expect(await finish(app, token, job.id)).toMatchObject({ stage: 'done', imageReady: true, model3d: 'failed' });
    expect((await request(app).get(`/v1/try-on/jobs/${job.id}/image`).set(bearer(token))).status).toBe(200);

    const failing = new FakeTryOnRenderer();
    failing.failResult = { kind: 'try_on', cause: 'provider_error' };
    const b = await signedIn('failtry@example.com', failing);
    await withPhoto(b.app, b.token);
    const lookB = await firstLook(b.app, b.token);
    const jobB = (await start(b.app, b.token, { outfitId: lookB.id })).body.data as TryOnJob;
    const failed = await finish(b.app, b.token, jobB.id);
    expect(failed).toMatchObject({ stage: 'failed', imageReady: false });
    expect(failed.message).toMatch(/couldn’t finish your try-on/);

    const refusing = new FakeTryOnRenderer();
    refusing.failSubmit = { kind: 'try_on', cause: 'rate_limited' };
    const c = await signedIn('busy@example.com', refusing);
    await withPhoto(c.app, c.token);
    const lookC = await firstLook(c.app, c.token);
    expect((await start(c.app, c.token, { outfitId: lookC.id })).body.error.code).toBe('RATE_LIMITED');
    // Nothing is stored for a try-on that couldn't be started.
    expect(await env.db.models.TryOnJob.countDocuments({ stage: 'try_on' })).toBe(0);
  });

  it('gives up a step that never finishes', async () => {
    const renderer = new FakeTryOnRenderer();
    renderer.pendingPolls = Number.POSITIVE_INFINITY;
    const { app, token } = await signedIn('slow@example.com', renderer);
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const job = (await start(app, token, { outfitId: look.id })).body.data as TryOnJob;
    await env.db.models.TryOnJob.updateOne(
      { _id: job.id },
      { $set: { stageStartedAt: new Date(Date.now() - 600_000) } },
    );
    expect((await poll(app, token, job.id)).stage).toBe('failed');
  });

  it('refuses an item that the search did not return', async () => {
    const { app, token, renderer } = await signedIn('made-up@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const { slotId, item } = await firstItem(app, token, look);
    const res = await start(app, token, { outfitId: look.id, slotId, item: { ...item, price: item.price + 1 } });
    expect(res.status).toBe(404);
    expect(renderer.tryOns).toHaveLength(0);
  });

  it('another user can’t see, fetch or delete a try-on', async () => {
    const a = await signedIn('owner@example.com');
    await withPhoto(a.app, a.token);
    const look = await firstLook(a.app, a.token);
    const job = (await start(a.app, a.token, { outfitId: look.id })).body.data as TryOnJob;
    await finish(a.app, a.token, job.id);

    const { mail } = a;
    await registerUser(a.app, env, mail, 'other@example.com');
    const other = await login(a.app, 'other@example.com');
    for (const path of ['', '/image', '/model']) {
      expect((await request(a.app).get(`/v1/try-on/jobs/${job.id}${path}`).set(bearer(other))).status).toBe(404);
    }
    expect((await request(a.app).delete(`/v1/try-on/jobs/${job.id}`).set(bearer(other))).status).toBe(404);
    expect((await start(a.app, other, { outfitId: look.id })).status).toBe(409);
  });

  it('deleting the try-on, the photo or the account deletes the try-on (USER_OWNED_COLLECTIONS)', async () => {
    expect(USER_OWNED_COLLECTIONS).toContain('tryOnJobs');
    const { app, token, mail } = await signedIn('gone@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const { slotId, item } = await firstItem(app, token, look);
    const first = (await start(app, token, { outfitId: look.id, slotId, item })).body.data as TryOnJob;
    expect((await request(app).delete(`/v1/try-on/jobs/${first.id}`).set(bearer(token))).status).toBe(200);
    expect(await env.db.models.TryOnJob.countDocuments()).toBe(0);

    await start(app, token, { outfitId: look.id, slotId, item });
    const photo = await env.db.models.UserPhoto.findOne({ kind: 'body' }).lean();
    await request(app)
      .delete(`/v1/photos/${String(photo!._id)}`)
      .set(bearer(token))
      .expect(200);
    expect(await env.db.models.TryOnJob.countDocuments()).toBe(0);

    await withPhoto(app, token);
    await start(app, token, { outfitId: look.id, slotId, item });
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true })
      .expect(200);
    expect(await env.db.models.TryOnJob.countDocuments()).toBe(0);
  });

  it('never logs photos, pictures, models or URLs', async () => {
    const { app, token } = await signedIn('quiet@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const job = (await start(app, token, { outfitId: look.id })).body.data as TryOnJob;
    await finish(app, token, job.id);
    const logs = logTextForPrivacyChecks(env.logLines);
    for (const value of [SYNTHETIC_JPEG.toString('base64'), 'cdn.example.test', 'gstatic', 'queue.fal.run']) {
      expect(logs).not.toContain(value);
    }
  });
});

describe('POST /v1/try-on/jobs with the outfit from the 3D mannequin (D-137)', () => {
  it('tries exactly those items on, layered bottom-up, and refuses items the search did not return', async () => {
    const { app, token, renderer } = await signedIn('outfit@example.com');
    await withPhoto(app, token);
    const look = await firstLook(app, token);
    const res = await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token)).expect(200);
    const products = lookProductMatchesSchema.parse(res.body.data);
    const items = products.slots
      .filter((s) => s.listings.length > 0)
      .slice(0, 2)
      .map((s) => {
        const l = s.listings[s.listings.length - 1]!;
        return { slotId: s.slotId, store: l.store, title: l.title, price: l.price };
      })
      .reverse();

    const job = await start(app, token, { outfitId: look.id, items });
    expect(job.status).toBe(202);
    const parsed = tryOnJobSchema.parse(job.body.data);
    expect(parsed.totalSteps).toBe(items.length);
    expect(parsed.garments.map((g) => g.slotId).sort()).toEqual(items.map((i) => i.slotId).sort());
    const order = { 'one-pieces': 0, bottoms: 1, tops: 2 } as const;
    expect((await finish(app, token, parsed.id)).stage).toBe('done');
    const categories = renderer.tryOns.map((t) => order[t.category]);
    expect(categories).toEqual([...categories].sort());

    const madeUp = await start(app, token, {
      outfitId: look.id,
      items: [{ ...items[0]!, price: items[0]!.price + 1 }],
    });
    expect(madeUp.status).toBe(404);
    const twice = await start(app, token, { outfitId: look.id, items: [items[0]!, items[0]!] });
    expect(twice.status).toBe(400);
  });
});
