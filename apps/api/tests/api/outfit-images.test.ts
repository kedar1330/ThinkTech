import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { lookSchema, outfitListResponseSchema, type Look } from '@styleme/contracts';
import { loadConfig } from '../../src/config/env';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeImageProvider } from '../fixtures/outfit-images';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { SYNTHETIC_JPEG } from '../fixtures/vision';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// AI outfit images on looks (GET /v1/outfits/:id/image) and looks built around a designed garment (D-132).
// Images come from a fake provider; nothing reaches Pollinations.

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

async function signedIn(email: string, options: { images?: FakeImageProvider } = {}) {
  const { app, mail } = env.makeApp(
    { OUTFIT_IMAGES_ENABLED: Boolean(options.images) },
    { styleLibrary, outfitImages: options.images },
  );
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
  return { app, token };
}

async function looks(app: Express, token: string, body: object = { occasion: 'everyday' }): Promise<Look[]> {
  const res = await request(app).post('/v1/recommendations').set(bearer(token)).send(body);
  expect(res.status).toBe(200);
  return (res.body.data.looks as Look[]).map((l) => lookSchema.parse(l));
}

describe('AI outfit images (GET /v1/outfits/:id/image)', () => {
  it('is off by default: looks carry no image and the image endpoint is not found', async () => {
    const { app, token } = await signedIn('off@example.com');
    const [look] = await looks(app, token);
    expect(look!.image).toBeUndefined();
    const res = await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token));
    expect(res.status).toBe(404);
  });

  it('makes the image on first view, stores it, and serves the stored copy afterwards', async () => {
    const images = new FakeImageProvider();
    const { app, token } = await signedIn('on@example.com', { images });
    const [look] = await looks(app, token);
    expect(look!.image).toBe('on_request');

    const first = await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token));
    expect(first.status).toBe(200);
    expect(first.headers['content-type']).toBe('image/jpeg');
    expect(first.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(first.body as Buffer).equals(SYNTHETIC_JPEG)).toBe(true);

    const again = await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token));
    expect(again.status).toBe(200);
    expect(images.calls).toHaveLength(1);

    const list = outfitListResponseSchema.parse(
      (await request(app).get('/v1/outfits?status=suggested').set(bearer(token))).body.data,
    );
    expect(list.looks.find((l) => l.id === look!.id)?.image).toBe('ready');
  });

  it('describes the outfit from the look only, never anything about the user', async () => {
    const images = new FakeImageProvider();
    const { app, token } = await signedIn('prompt@example.com', { images });
    const [look] = await looks(app, token, { occasion: 'festive' });
    await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token)).expect(200);

    const { prompt, width, height, seed } = images.calls[0]!;
    expect(prompt).toContain('a woman');
    expect(prompt).toContain('festive');
    // Garments only: shoes and accessories are left out of the picture's description.
    const garment = (slot: { slot: string }) => !['footwear', 'accessory'].includes(slot.slot);
    expect(look!.slots.some((slot) => !garment(slot))).toBe(true);
    for (const slot of look!.slots) {
      if (garment(slot)) expect(prompt).toContain(slot.searchPhrase);
      else expect(prompt).not.toContain(slot.searchPhrase);
    }
    expect(prompt).not.toMatch(/skin|undertone|body type|height|weight|prompt@example\.com/i);
    expect([width, height]).toEqual([768, 1024]);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('dresses the image in colours from the user’s My Colour Palette', async () => {
    const images = new FakeImageProvider();
    const { app, token } = await signedIn('palette-image@example.com', { images });
    const user = await env.db.models.User.findOne({ email: 'palette-image@example.com' }).lean();
    await env.db.models.ColourSwatch.create({
      colourId: 'CLR-9101',
      name: 'Deep Teal',
      hex: '#0F4C5C',
      rgb: [15, 76, 92],
      oklch: { l: 0.4, c: 0.06, h: 220 },
      family: 'blue',
      temperature: 'cool',
      depth: 'deep',
      intensity: 'medium',
      source: 'css',
      isFixture: true,
    });
    await env.db.models.UserColourPreference.create({
      userId: user!._id,
      colours: [{ colourId: 'CLR-9101', preference: 'liked', savedAt: new Date() }],
    });
    const [look] = await looks(app, token);
    await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token)).expect(200);

    // One liked colour: every garment is shown in it, with the rest of its description kept.
    const { prompt } = images.calls[0]!;
    for (const slot of look!.slots.filter((s) => !['footwear', 'accessory'].includes(s.slot))) {
      const rest = slot.searchPhrase.slice(slot.swatches[0]!.name.length);
      expect(prompt).toContain(`deep teal${rest}`);
    }
    expect(await env.db.models.OutfitImage.findOne({ outfitId: look!.id }).lean()).toMatchObject({
      promptVersion: 'outfit-image-v2',
    });
  });

  it('keeps another user’s look and image private', async () => {
    const images = new FakeImageProvider();
    const owner = await signedIn('owner@example.com', { images });
    const [look] = await looks(owner.app, owner.token);
    const other = await signedIn('other@example.com', { images });
    const res = await request(other.app).get(`/v1/outfits/${look!.id}/image`).set(bearer(other.token));
    expect(res.status).toBe(404);
    expect(images.calls).toHaveLength(0);
  });

  it('keeps the image when the look is saved and deletes it with the look', async () => {
    const images = new FakeImageProvider();
    const { app, token } = await signedIn('keep@example.com', { images });
    const [look] = await looks(app, token);
    await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token)).expect(200);

    const saved = await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    expect(saved.body.data.image).toBe('ready');
    const stored = await env.db.models.OutfitImage.findOne({ outfitId: look!.id }).lean();
    expect(stored?.expiresAt).toBeNull();

    await request(app).delete(`/v1/outfits/${look!.id}`).set(bearer(token)).expect(200);
    expect(await env.db.models.OutfitImage.countDocuments({ outfitId: look!.id })).toBe(0);
  });

  it('reports a provider failure without storing anything or logging the prompt', async () => {
    const images = new FakeImageProvider();
    images.reply = { kind: 'fail', cause: 'provider_error' };
    const { app, token } = await signedIn('fail@example.com', { images });
    const [look] = await looks(app, token);
    env.logLines.length = 0;
    const res = await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
    expect(await env.db.models.OutfitImage.countDocuments()).toBe(0);
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).toContain('outfit_image_failed');
    expect(logs).not.toContain(look!.slots[0]!.searchPhrase);

    images.reply = { kind: 'fail', cause: 'rate_limited' };
    const limited = await request(app).get(`/v1/outfits/${look!.id}/image`).set(bearer(token));
    expect(limited.status).toBe(429);
  });

  it('can be switched on only locally, and only with a key', () => {
    const base = {
      APP_ENV: 'local',
      MONGODB_URI: 'mongodb://x',
      TOMBSTONE_STORE_URI: 'mongodb://y',
      TOMBSTONE_HMAC_KEY: 'k'.repeat(32),
      AUTH_ACCESS_TOKEN_SECRET: 'a'.repeat(32),
      BFF_SHARED_SECRET: 'b'.repeat(32),
      WEB_ORIGIN: 'http://localhost:3000',
      OUTFIT_IMAGES_ENABLED: 'true',
    };
    expect(() => loadConfig(base)).toThrow(/POLLINATIONS_API_KEY/);
    expect(() => loadConfig({ ...base, APP_ENV: 'staging', POLLINATIONS_API_KEY: 'sk_test' })).toThrow(
      /OUTFIT_IMAGES_ENABLED/,
    );
    expect(loadConfig({ ...base, POLLINATIONS_API_KEY: 'sk_test' }).OUTFIT_IMAGES_ENABLED).toBe(true);
  });
});

describe('looks built around a designed garment (D-132)', () => {
  async function saveDesign(email: string, selectedFeatures: Record<string, string>) {
    const user = await env.db.models.User.findOne({ email }).lean();
    await env.db.models.UserDesignSelection.create({
      userId: user!._id,
      clothingPreference: 'women',
      outfitCategory: 'indian',
      garmentType: 'kurti',
      selectedFeatures,
      savedAt: new Date(),
    });
  }

  it('ranks looks with the designed garment first and says what differs', async () => {
    const { app, token } = await signedIn('design@example.com');
    await saveDesign('design@example.com', { neckline: 'neckline_v_neck', sleeve: 'sleeve_elbow' });
    const result = await looks(app, token, {
      occasion: 'everyday',
      design: { garmentType: 'kurti', outfitCategory: 'indian' },
    });
    expect(result.length).toBeGreaterThan(0);
    const rank = (l: Look) =>
      l.designMatch!.level === 'full' ? 0 : l.designMatch!.level === 'partial' ? l.designMatch!.differs.length : 100;
    expect(result.every((l) => l.designMatch)).toBe(true);
    expect(result.map(rank)).toEqual([...result.map(rank)].sort((a, b) => a - b));
    for (const look of result) {
      const kurti = look.slots.find((s) => s.lookSpec.category === 'kurti');
      expect(look.designMatch!.level === 'none').toBe(!kurti);
    }
    // Stored with the look, so the saved look keeps it.
    const detail = await request(app).get(`/v1/outfits/${result[0]!.id}`).set(bearer(token));
    expect(detail.body.data.designMatch).toEqual(result[0]!.designMatch);
    expect(detail.body.data.request.design).toEqual({ garmentType: 'kurti', outfitCategory: 'indian' });
  });

  it('ignores a design the user has not saved, and leaves requests without a design unchanged', async () => {
    const { app, token } = await signedIn('nodesign@example.com');
    await saveDesign('nodesign@example.com', { neckline: 'neckline_v_neck' });
    const other = await signedIn('someone@example.com');
    const theirs = await looks(other.app, other.token, {
      occasion: 'everyday',
      design: { garmentType: 'kurti', outfitCategory: 'indian' },
    });
    expect(theirs.every((l) => l.designMatch === undefined)).toBe(true);

    const plain = await looks(app, token);
    expect(plain.every((l) => l.designMatch === undefined)).toBe(true);
  });
});
