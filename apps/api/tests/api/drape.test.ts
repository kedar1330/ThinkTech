import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  lookProductMatchesSchema,
  lookSchema,
  tryOnDrapeSchema,
  tryOnOverviewSchema,
  type Look,
} from '@styleme/contracts';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import { DRAPE_PROMPT_VERSION, drapePrompt, viewPrompt } from '../../src/services/drape.service';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeImageGenerator } from '../fixtures/design-studio';
import { FakeImageEditor } from '../fixtures/drape';
import { FakeShoppingProvider } from '../fixtures/shopping';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { SYNTHETIC_JPEG, SYNTHETIC_PNG } from '../fixtures/vision';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Cartoon avatar drape (D-138): a shared cartoon avatar (fake image generator) is dressed in the outfit's real
// items by image editing (fake Pollinations editor), one garment at a time. Nothing about the user is sent.

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

async function signedIn(email: string, editor: FakeImageEditor | null = new FakeImageEditor(), overrides = {}) {
  const generator = new FakeImageGenerator('pollinations');
  const { app, mail } = env.makeApp(overrides, {
    styleLibrary,
    shopping: new FakeShoppingProvider(),
    imageGenerators: [generator],
    ...(editor ? { imageEditor: editor } : {}),
  });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
  return { app, mail, token, editor: editor!, generator };
}

async function outfit(app: Express, token: string) {
  const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
  const look: Look = lookSchema.parse(res.body.data.looks[0]);
  const products = lookProductMatchesSchema.parse(
    (await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token)).expect(200)).body.data,
  );
  const items = products.slots
    .filter((s) => s.listings.length > 0)
    .slice(0, 2)
    .map((s) => ({
      slotId: s.slotId,
      store: s.listings[0]!.store,
      title: s.listings[0]!.title,
      price: s.listings[0]!.price,
    }));
  return { look, items, products };
}

const drape = (app: Express, token: string, body: Record<string, unknown>) =>
  request(app).post('/v1/try-on/drapes').set(bearer(token)).send(body);

const binary = (req: request.Test) =>
  req.buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on('data', (c: Buffer) => chunks.push(c));
    r.on('end', () => cb(null, Buffer.concat(chunks)));
  });

describe('/v1/try-on avatars and drapes (D-138)', () => {
  it('every endpoint requires a signed-in user', async () => {
    const { app } = env.makeApp();
    for (const res of [
      await request(app).get('/v1/try-on/avatars/women'),
      await request(app).post('/v1/try-on/drapes').send({}),
      await request(app).get(`/v1/try-on/drapes/${'a'.repeat(24)}/image`),
      await request(app).delete(`/v1/try-on/drapes/${'a'.repeat(24)}`),
    ]) {
      expect(res.status).toBe(401);
    }
  });

  it('generates each cartoon avatar once from a fixed prompt, then shares it', async () => {
    const { app, token, generator } = await signedIn('avatar@example.com');
    const first = await binary(request(app).get('/v1/try-on/avatars/women').set(bearer(token)));
    expect(first.status).toBe(200);
    expect(first.body).toEqual(SYNTHETIC_JPEG);
    await request(app).get('/v1/try-on/avatars/women').set(bearer(token)).expect(200);
    expect(generator.prompts).toHaveLength(1);
    expect(generator.prompts[0]).toMatch(/photorealistic.*young indian woman/i);
    // Nothing about the user is in the prompt.
    expect(generator.prompts[0]).not.toMatch(/avatar@example|women'?s wear|skin tone|body type/i);
    await request(app).get('/v1/try-on/avatars/men').set(bearer(token)).expect(200);
    expect(generator.prompts).toHaveLength(2);
    expect((await request(app).get('/v1/try-on/avatars/kids').set(bearer(token))).status).toBe(404);
  });

  it('dresses the avatar one garment at a time, each on the last result, with only the store thumbnails', async () => {
    const { app, token, editor } = await signedIn('drape@example.com');
    const { look, items, products } = await outfit(app, token);
    expect(
      tryOnOverviewSchema.parse((await request(app).get('/v1/try-on').set(bearer(token))).body.data).drapeAvailable,
    ).toBe(true);

    const res = await drape(app, token, { outfitId: look.id, department: 'women', items });
    expect(res.status).toBe(201);
    const dressed = tryOnDrapeSchema.parse(res.body.data);
    expect(dressed.garments.map((g) => g.slotId).sort()).toEqual(items.map((i) => i.slotId).sort());

    expect(editor.edits).toHaveLength(items.length);
    expect(editor.edits[0]!.images[0]).toBe(`data:image/jpeg;base64,${SYNTHETIC_JPEG.toString('base64')}`);
    for (const [i, edit] of editor.edits.entries()) {
      const garment = dressed.garments[i]!;
      const listing = products.slots.find((s) => s.slotId === garment.slotId)!.listings[0]!;
      expect(edit.images[1]).toBe(listing.imageUrl);
      expect(edit.prompt).toBe(
        drapePrompt({ category: edit.prompt.includes('trousers, jeans') ? 'bottoms' : 'tops', title: garment.title }),
      );
      expect(edit.prompt).not.toMatch(/drape@example|budget|height/i);
    }
    // The second garment goes on the first result.
    if (items.length > 1) {
      const firstResult = Buffer.concat([SYNTHETIC_PNG, Buffer.from('edit-1')]);
      expect(editor.edits[1]!.images[0]).toBe(`data:image/png;base64,${firstResult.toString('base64')}`);
    }

    const image = await binary(request(app).get(`/v1/try-on/drapes/${dressed.id}/image`).set(bearer(token)));
    expect(image.status).toBe(200);
    expect(image.headers['cache-control']).toBe('private, no-store');
    expect(image.body).toEqual(Buffer.concat([SYNTHETIC_PNG, Buffer.from(`edit-${items.length}`)]));

    // The same avatar and items are reused, not dressed again.
    const again = await drape(app, token, { outfitId: look.id, department: 'women', items });
    expect(again.body.data.id).toBe(dressed.id);
    expect(editor.edits).toHaveLength(items.length);
  });

  it('refuses items the search did not return, and another user’s look or picture', async () => {
    const a = await signedIn('owner@example.com');
    const { look, items } = await outfit(a.app, a.token);
    const madeUp = await drape(a.app, a.token, {
      outfitId: look.id,
      department: 'women',
      items: [{ ...items[0]!, title: 'Not in the search' }],
    });
    expect(madeUp.status).toBe(404);
    expect(a.editor.edits).toHaveLength(0);

    const dressed = (await drape(a.app, a.token, { outfitId: look.id, department: 'women', items })).body.data;
    await registerUser(a.app, env, a.mail, 'other@example.com');
    const other = await login(a.app, 'other@example.com');
    expect((await request(a.app).get(`/v1/try-on/drapes/${dressed.id}/image`).set(bearer(other))).status).toBe(404);
    expect((await request(a.app).delete(`/v1/try-on/drapes/${dressed.id}`).set(bearer(other))).status).toBe(404);
    expect((await drape(a.app, other, { outfitId: look.id, department: 'women', items })).status).toBe(404);
  });

  it('says why when the editor fails or is off, and stores nothing', async () => {
    const failing = new FakeImageEditor();
    failing.fail = 'provider_error';
    const { app, token } = await signedIn('fail@example.com', failing);
    const { look, items } = await outfit(app, token);
    const res = await drape(app, token, { outfitId: look.id, department: 'women', items });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatchObject({ code: 'AI_UNAVAILABLE', message: expect.stringMatching(/couldn’t dress/) });
    expect(await env.db.models.TryOnDrape.countDocuments()).toBe(0);

    const off = await signedIn('off@example.com', new FakeImageEditor(), { DRAPE_ENABLED: false });
    expect((await request(off.app).get('/v1/try-on').set(bearer(off.token))).body.data.drapeAvailable).toBe(false);
    const offLook = await outfit(off.app, off.token);
    expect(
      (await drape(off.app, off.token, { outfitId: offLook.look.id, department: 'women', items: offLook.items })).body
        .error.code,
    ).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('the user can delete a dressed avatar; account deletion removes them (USER_OWNED_COLLECTIONS)', async () => {
    expect(USER_OWNED_COLLECTIONS).toContain('tryOnDrapes');
    const { app, token, mail } = await signedIn('gone@example.com');
    const { look, items } = await outfit(app, token);
    const first = (await drape(app, token, { outfitId: look.id, department: 'women', items })).body.data;
    await request(app).delete(`/v1/try-on/drapes/${first.id}`).set(bearer(token)).expect(200);
    expect(await env.db.models.TryOnDrape.countDocuments()).toBe(0);
    await drape(app, token, { outfitId: look.id, department: 'women', items: items.slice(0, 1) });
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true })
      .expect(200);
    expect(await env.db.models.TryOnDrape.countDocuments()).toBe(0);
    // The shared avatar stays: it belongs to no one.
    expect(await env.db.models.TryOnAvatar.countDocuments()).toBe(1);
  });

  it('draws the three-quarter, side and back views from the dressed front, once each (D-139)', async () => {
    const { app, token, editor, mail } = await signedIn('views@example.com');
    const { look, items } = await outfit(app, token);
    const dressed = tryOnDrapeSchema.parse(
      (await drape(app, token, { outfitId: look.id, department: 'women', items: items.slice(0, 1) })).body.data,
    );
    expect(dressed.views).toEqual(['front']);
    expect((await request(app).get(`/v1/try-on/drapes/${dressed.id}/image?view=side`).set(bearer(token))).status).toBe(
      404,
    );

    const front = Buffer.concat([SYNTHETIC_PNG, Buffer.from('edit-1')]);
    const side = await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/side`).set(bearer(token));
    expect(side.status).toBe(200);
    expect(tryOnDrapeSchema.parse(side.body.data).views).toEqual(['front', 'side']);
    // Only the dressed front goes to the editor, with the turn.
    expect(editor.edits[1]).toEqual({
      prompt: viewPrompt('side', items[0]!.title),
      images: [`data:image/png;base64,${front.toString('base64')}`],
    });
    const image = await binary(request(app).get(`/v1/try-on/drapes/${dressed.id}/image?view=side`).set(bearer(token)));
    expect(image.status).toBe(200);
    expect(image.body).toEqual(Buffer.concat([SYNTHETIC_PNG, Buffer.from('edit-2')]));

    // Drawn once: asking again returns it without another edit.
    await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/side`).set(bearer(token)).expect(200);
    expect(editor.edits).toHaveLength(2);
    for (const view of ['three_quarter', 'back'] as const) {
      await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/${view}`).set(bearer(token)).expect(200);
    }
    const all = (await drape(app, token, { outfitId: look.id, department: 'women', items: items.slice(0, 1) })).body
      .data;
    expect([...all.views].sort()).toEqual(['back', 'front', 'side', 'three_quarter']);
    expect((await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/front`).set(bearer(token))).status).toBe(
      404,
    );
    expect((await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/top`).set(bearer(token))).status).toBe(404);

    // Another user can't draw or see a view.
    await registerUser(app, env, mail, 'nosy@example.com');
    const other = await login(app, 'nosy@example.com');
    expect((await request(app).post(`/v1/try-on/drapes/${dressed.id}/views/back`).set(bearer(other))).status).toBe(404);
    expect((await request(app).get(`/v1/try-on/drapes/${dressed.id}/image?view=back`).set(bearer(other))).status).toBe(
      404,
    );
  });

  it('draws the model again when its prompts change', async () => {
    const { app, token, generator } = await signedIn('version@example.com');
    await request(app).get('/v1/try-on/avatars/women').set(bearer(token)).expect(200);
    await env.db.models.TryOnAvatar.updateOne({ department: 'women' }, { $set: { promptVersion: 'cartoon-drape-v1' } });
    await request(app).get('/v1/try-on/avatars/women').set(bearer(token)).expect(200);
    expect(generator.prompts).toHaveLength(2);
    expect((await env.db.models.TryOnAvatar.findOne({ department: 'women' }).lean())?.promptVersion).toBe(
      DRAPE_PROMPT_VERSION,
    );
  });

  it('never logs pictures, prompts or thumbnail URLs', async () => {
    const failing = new FakeImageEditor();
    const { app, token } = await signedIn('quiet@example.com', failing);
    const { look, items } = await outfit(app, token);
    await drape(app, token, { outfitId: look.id, department: 'women', items });
    failing.fail = 'rate_limited';
    await drape(app, token, {
      outfitId: look.id,
      department: 'women',
      items: items.slice(0, 1).map((i) => ({ ...i })),
    });
    const logs = logTextForPrivacyChecks(env.logLines);
    for (const value of [SYNTHETIC_JPEG.toString('base64'), 'gstatic', 'Dress the cartoon avatar']) {
      expect(logs).not.toContain(value);
    }
  });
});
