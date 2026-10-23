import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DESIGN_NOTICE_VERSION, DESIGN_REQUEST_CONTENT_TYPE, type Look } from '@styleme/contracts';
import { createRateLimits } from '../../src/middleware/rate-limit';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeDesignAnalysis, FakeImageGenerator } from '../fixtures/design-studio';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
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

// Design Studio (D-134): sketch / upload / description / look + change → Gemini (fake) → image generators
// (fakes, Pollinations then Cloudflare) → design with a tailor spec, stored privately.

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

function providers() {
  return {
    analysis: new FakeDesignAnalysis(),
    pollinations: new FakeImageGenerator('pollinations'),
    cloudflare: new FakeImageGenerator('cloudflare'),
  };
}

async function signedIn(email: string, p = providers(), overrides = {}, options: AppOptions = {}) {
  const { app, mail } = env.makeApp(overrides, {
    styleLibrary,
    designAnalysis: p.analysis,
    imageGenerators: [p.pollinations, p.cloudflare],
    ...options,
  });
  await registerUser(app, env, mail, email);
  return { app, mail, token: await login(app, email), ...p };
}

function create(app: Express, token: string, body: Record<string, unknown>) {
  return request(app)
    .post('/v1/design-studio/designs')
    .set(bearer(token))
    .set('content-type', DESIGN_REQUEST_CONTENT_TYPE)
    .send(JSON.stringify({ notice: DESIGN_NOTICE_VERSION, ...body }));
}

const sketch = { contentType: 'image/jpeg', base64: SYNTHETIC_JPEG.toString('base64') };

describe('/v1/design-studio (D-134)', () => {
  it('every endpoint requires a signed-in user', async () => {
    const { app } = env.makeApp();
    const id = '64b7f0c2a1b2c3d4e5f60718';
    for (const call of [
      request(app).get('/v1/design-studio'),
      request(app).post('/v1/design-studio/designs'),
      request(app).get(`/v1/design-studio/designs/${id}`),
      request(app).get(`/v1/design-studio/designs/${id}/image`),
      request(app).post(`/v1/design-studio/designs/${id}/render`),
      request(app).delete(`/v1/design-studio/designs/${id}`),
    ]) {
      expect((await call).status).toBe(401);
    }
  });

  it('designs from a description: tailor spec, picture from Pollinations, stored privately', async () => {
    const { app, token, analysis, pollinations, cloudflare } = await signedIn('desc@example.com');
    const res = await create(app, token, { source: 'description', description: 'A teal kurta with puff sleeves' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: 'Fixture puff-sleeve kurta',
      source: 'description',
      imageStatus: 'ready',
      imageProvider: 'pollinations',
      hasSourceImage: false,
      tailorSpec: { garment: 'Straight kurta', yardage: { estimate: '2.5–3 m of 44-inch fabric' } },
    });
    expect(res.body.data).not.toHaveProperty('imagePrompt');

    // Gemini gets the user's words and no image; the image service gets only the guarded garment prompt.
    expect(analysis.calls[0]!.image).toBeNull();
    expect(analysis.calls[0]!.brief).toContain('A teal kurta with puff sleeves');
    expect(pollinations.prompts).toHaveLength(1);
    expect(pollinations.prompts[0]).toContain('No people, no faces');
    expect(pollinations.prompts[0]).not.toContain('desc@example.com');
    expect(cloudflare.prompts).toHaveLength(0);

    const image = await request(app).get(`/v1/design-studio/designs/${res.body.data.id}/image`).set(bearer(token));
    expect(image.status).toBe(200);
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(image.body as Buffer)).toEqual(SYNTHETIC_JPEG);

    const overview = await request(app).get('/v1/design-studio').set(bearer(token));
    expect(overview.body.data).toMatchObject({ available: true, imagesAvailable: true, limit: 50 });
    expect(overview.body.data.designs).toHaveLength(1);
  });

  it('designs from a sketch: the sketch goes to Gemini only, and is kept for the user', async () => {
    const { app, token, analysis, pollinations } = await signedIn('sketch@example.com');
    const res = await create(app, token, { source: 'sketch', image: sketch, description: 'anarkali' });
    expect(res.status).toBe(201);
    expect(res.body.data.hasSourceImage).toBe(true);
    expect(analysis.calls[0]!.image).toEqual({ bytes: SYNTHETIC_JPEG, contentType: 'image/jpeg' });
    expect(pollinations.prompts[0]).not.toContain(SYNTHETIC_JPEG.toString('base64'));
    const source = await request(app)
      .get(`/v1/design-studio/designs/${res.body.data.id}/image?which=source`)
      .set(bearer(token));
    expect(Buffer.from(source.body as Buffer)).toEqual(SYNTHETIC_JPEG);
  });

  it('designs from a look: keeps the look, changes only what the user asked, and sends no profile data', async () => {
    const { app, token, analysis } = await signedIn('look@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', heightCm: 162 }).expect(200);
    const recs = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    const look = (recs.body.data.looks as Look[])[0]!;
    const slot = look.slots[0]!;

    const res = await create(app, token, {
      source: 'look',
      lookId: look.id,
      slotId: slot.slotId,
      description: 'Make the sleeves bell sleeves',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ source: 'look', lookId: look.id });
    const brief = analysis.calls[0]!.brief;
    expect(brief).toContain('Make the sleeves bell sleeves');
    expect(brief).toContain(slot.swatches[0]!.name);
    expect(brief).toContain('← the piece to change');
    expect(brief).not.toContain('162');
    expect(analysis.calls[0]!.image).toBeNull();
  });

  it('another user’s look or design is NOT_FOUND', async () => {
    const owner = await signedIn('owner@example.com');
    const recs = await request(owner.app)
      .post('/v1/recommendations')
      .set(bearer(owner.token))
      .send({ occasion: 'everyday' });
    const lookId = (recs.body.data.looks as Look[])[0]!.id;
    const design = await create(owner.app, owner.token, { source: 'description', description: 'A long linen dress' });

    const { mail } = owner;
    await registerUser(owner.app, env, mail, 'other@example.com');
    const other = await login(owner.app, 'other@example.com');
    expect((await create(owner.app, other, { source: 'look', lookId, description: 'shorter' })).status).toBe(404);
    for (const path of ['', '/image']) {
      const res = await request(owner.app)
        .get(`/v1/design-studio/designs/${design.body.data.id}${path}`)
        .set(bearer(other));
      expect(res.status).toBe(404);
    }
    expect(
      (await request(owner.app).delete(`/v1/design-studio/designs/${design.body.data.id}`).set(bearer(other))).status,
    ).toBe(404);
  });

  it('falls back to Cloudflare when Pollinations fails or returns something that is not an image', async () => {
    for (const mode of ['fail', 'garbage'] as const) {
      await env.reset();
      const p = providers();
      p.pollinations.mode = mode;
      const { app, token } = await signedIn(`fallback-${mode}@example.com`, p);
      const res = await create(app, token, { source: 'description', description: 'A short silk jacket' });
      expect(res.body.data).toMatchObject({ imageStatus: 'ready', imageProvider: 'cloudflare' });
      expect(p.cloudflare.prompts).toHaveLength(1);
    }
  });

  it('when every image service fails, the design is kept with its spec and the picture can be retried', async () => {
    const p = providers();
    p.pollinations.mode = 'fail';
    p.cloudflare.mode = 'fail';
    const { app, token } = await signedIn('retry@example.com', p);
    const res = await create(app, token, { source: 'description', description: 'A wrap dress in mustard' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ imageStatus: 'failed', imageProvider: null });
    expect(
      (await request(app).get(`/v1/design-studio/designs/${res.body.data.id}/image`).set(bearer(token))).status,
    ).toBe(404);

    const stillDown = await request(app)
      .post(`/v1/design-studio/designs/${res.body.data.id}/render`)
      .set(bearer(token));
    expect(stillDown.status).toBe(503);
    p.cloudflare.mode = 'ok';
    const retried = await request(app).post(`/v1/design-studio/designs/${res.body.data.id}/render`).set(bearer(token));
    expect(retried.body.data).toMatchObject({ imageStatus: 'ready', imageProvider: 'cloudflare' });
    // The retry reuses the stored prompt; Gemini is not called again.
    expect(p.analysis.calls).toHaveLength(1);
  });

  it('an unusable input (e.g. a photo of a person) is refused and nothing is stored', async () => {
    const p = providers();
    p.analysis.reply = { kind: 'reply', body: { usable: false, reason: 'shows_person' } };
    const { app, token } = await signedIn('person@example.com', p);
    const res = await create(app, token, { source: 'upload', image: sketch });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DESIGN_UNUSABLE');
    expect(res.body.error.message).toMatch(/photos of people/);
    expect(await env.db.models.Design.countDocuments()).toBe(0);
    expect(p.pollinations.prompts).toHaveLength(0);
  });

  it('a malformed Gemini reply or a Gemini failure is AI_UNAVAILABLE; Gemini rate limits are RATE_LIMITED', async () => {
    const p = providers();
    const { app, token } = await signedIn('bad@example.com', p);
    p.analysis.reply = { kind: 'reply', body: { usable: true, title: 'x' } };
    expect((await create(app, token, { source: 'description', description: 'A pleated skirt' })).body.error.code).toBe(
      'AI_UNAVAILABLE',
    );
    p.analysis.reply = { kind: 'fail', cause: 'rate_limited' };
    expect((await create(app, token, { source: 'description', description: 'A pleated skirt' })).body.error.code).toBe(
      'RATE_LIMITED',
    );
    expect(await env.db.models.Design.countDocuments()).toBe(0);
  });

  it('validates the request: notice, image only for sketches, look only with a lookId, real images only', async () => {
    // The real limit (5 a minute) runs before validation; this test sends more than that.
    const { app, token } = await signedIn(
      'valid@example.com',
      providers(),
      {},
      {
        rateLimits: { ...createRateLimits(), designStudio: [] },
      },
    );
    for (const body of [
      { source: 'description', description: 'A kurta with pockets', notice: 'old' },
      { source: 'description', description: 'short' },
      { source: 'sketch' },
      { source: 'description', description: 'A kurta with pockets', image: sketch },
      { source: 'look', description: 'shorter' },
      { source: 'upload', image: { contentType: 'image/png', base64: Buffer.from('not an image').toString('base64') } },
    ]) {
      const res = await create(app, token, body);
      expect(res.status).toBe(400);
    }
  });

  it('is unavailable (PROVIDER_NOT_CONFIGURED) when switched off', async () => {
    const { app, token } = await signedIn('off@example.com', providers(), { DESIGN_STUDIO_ENABLED: false });
    const overview = await request(app).get('/v1/design-studio').set(bearer(token));
    expect(overview.body.data).toMatchObject({ available: false, imagesAvailable: false });
    const res = await create(app, token, { source: 'description', description: 'A kurta with pockets' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('the user can delete a design; account deletion removes all designs (USER_OWNED_COLLECTIONS)', async () => {
    expect(USER_OWNED_COLLECTIONS).toContain('designs');
    const { app, token, mail } = await signedIn('gone@example.com');
    const first = await create(app, token, { source: 'description', description: 'A cape in deep green' });
    await create(app, token, { source: 'description', description: 'A cape in deep blue' });
    expect(
      (await request(app).delete(`/v1/design-studio/designs/${first.body.data.id}`).set(bearer(token))).status,
    ).toBe(200);
    expect(await env.db.models.Design.countDocuments()).toBe(1);

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true })
      .expect(200);
    expect(await env.db.models.Design.countDocuments()).toBe(0);
  });

  it('never logs descriptions, prompts or images', async () => {
    const p = providers();
    p.pollinations.mode = 'fail';
    const { app, token } = await signedIn('logs@example.com', p);
    await create(app, token, { source: 'sketch', image: sketch, description: 'Secret-wedding-lehenga-idea' });
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).toContain('design_image_failed');
    for (const value of ['Secret-wedding-lehenga-idea', 'teal with elbow-length', SYNTHETIC_JPEG.toString('base64')]) {
      expect(logs).not.toContain(value);
    }
  });
});
