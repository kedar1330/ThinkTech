import { Types } from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAVED_LIMITS, lookSchema, outfitDetailSchema, outfitListResponseSchema, type Look } from '@styleme/contracts';
import { lookIdentityKey } from '../../src/services/outfits.service';
import { SUGGESTED_LOOK_TTL_MS } from '../../src/services/recommendations.service';
import { loadStyleLibrary } from '../../src/style-rules';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Saved looks (FR-OUT-01 … 03, FR-OUT-05, API.md §3.5 #14 – #16, #18; T-04, T-31). Looks are generated
// on the synthetic fixture library, as in recommendations.test.ts.

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

async function signedIn(email: string) {
  const { app, mail } = env.makeApp({}, { styleLibrary });
  await registerUser(app, env, mail, email);
  return { app, token: await login(app, email) };
}

async function generate(app: Express, token: string, occasion = 'everyday'): Promise<Look[]> {
  const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion });
  expect(res.status).toBe(200);
  return res.body.data.looks as Look[];
}

const ID_NOBODY_HAS = '64b7f0c2a1b2c3d4e5f60718';

describe('/v1/outfits (saved looks)', () => {
  it('every endpoint requires a signed-in user', async () => {
    const { app } = env.makeApp({}, { styleLibrary });
    for (const call of [
      request(app).get('/v1/outfits'),
      request(app).get(`/v1/outfits/${ID_NOBODY_HAS}`),
      request(app).post(`/v1/outfits/${ID_NOBODY_HAS}/save`),
      request(app).delete(`/v1/outfits/${ID_NOBODY_HAS}`),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('T-31 saving keeps the look exactly as generated, with status saved and no expiry', async () => {
    const { app, token } = await signedIn('save@example.com');
    const [look] = await generate(app, token);

    const res = await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    expect(res.status).toBe(200);
    const saved = lookSchema.parse(res.body.data);
    expect(saved).toEqual({ ...look, status: 'saved' });

    const stored = await env.db.models.Outfit.findById(look!.id).lean();
    expect(stored!.status).toBe('saved');
    expect(stored).not.toHaveProperty('expiresAt');
    expect(stored!.slots).toEqual(look!.slots);
    expect(stored!.explanation).toBe(look!.explanation);
    expect(stored!.explanationRefs).toEqual(look!.explanationRefs);
  });

  it('saving twice is harmless and returns the same look', async () => {
    const { app, token } = await signedIn('twice@example.com');
    const [look] = await generate(app, token);
    const first = await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    const second = await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    expect(second.status).toBe(200);
    expect(second.body.data).toEqual(first.body.data);
    expect(await env.db.models.Outfit.countDocuments({ status: 'saved' })).toBe(1);
  });

  it('T-31 suggested looks keep their 7-day expiry until saved, and expired ones are gone', async () => {
    const { app, token } = await signedIn('expiry@example.com');
    const before = Date.now();
    const [kept] = await generate(app, token);
    const [lapsed] = await generate(app, token);
    const stored = await env.db.models.Outfit.findById(kept!.id).lean();
    expect(stored!.expiresAt!.getTime() - before).toBeGreaterThanOrEqual(SUGGESTED_LOOK_TTL_MS);
    expect((await request(app).get(`/v1/outfits/${kept!.id}`).set(bearer(token))).body.data.status).toBe('suggested');

    // Past its expiry: the TTL index removes it within about a minute; until then it is already hidden.
    await env.db.models.Outfit.updateOne({ _id: lapsed!.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    for (const res of [
      await request(app).get(`/v1/outfits/${lapsed!.id}`).set(bearer(token)),
      await request(app).post(`/v1/outfits/${lapsed!.id}/save`).set(bearer(token)),
      await request(app).delete(`/v1/outfits/${lapsed!.id}`).set(bearer(token)),
    ]) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    const suggested = await request(app).get('/v1/outfits?status=suggested&limit=50').set(bearer(token));
    expect(suggested.body.data.looks.map((l: Look) => l.id)).not.toContain(lapsed!.id);
  });

  it('lists saved looks by default, newest first, with the total; status=suggested lists the rest', async () => {
    const { app, token } = await signedIn('list@example.com');
    const looks = [...(await generate(app, token, 'everyday')), ...(await generate(app, token, 'work'))];
    expect(looks.length).toBeGreaterThanOrEqual(3);
    const toSave = looks.slice(0, 3).map((l) => l.id);
    for (const id of toSave) await request(app).post(`/v1/outfits/${id}/save`).set(bearer(token)).expect(200);

    const res = await request(app).get('/v1/outfits').set(bearer(token));
    expect(res.status).toBe(200);
    const data = outfitListResponseSchema.parse(res.body.data);
    expect(data).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(data.looks.every((l) => l.status === 'saved')).toBe(true);
    const newestFirst = await env.db.models.Outfit.find({ status: 'saved' }).sort({ createdAt: -1, _id: -1 }).lean();
    expect(data.looks.map((l) => l.id)).toEqual(newestFirst.map((o) => String(o._id)));

    const suggested = outfitListResponseSchema.parse(
      (await request(app).get('/v1/outfits?status=suggested').set(bearer(token))).body.data,
    );
    expect(suggested.total).toBe(looks.length - 3);
    expect(suggested.looks.every((l) => l.status === 'suggested' && !toSave.includes(l.id))).toBe(true);
  });

  it('paginates with page and limit', async () => {
    const { app, token } = await signedIn('pages@example.com');
    const looks = [...(await generate(app, token, 'everyday')), ...(await generate(app, token, 'work'))];
    for (const look of looks.slice(0, 3))
      await request(app).post(`/v1/outfits/${look.id}/save`).set(bearer(token)).expect(200);

    const page = (n: number) => request(app).get(`/v1/outfits?page=${n}&limit=2`).set(bearer(token));
    const [one, two, three] = [(await page(1)).body.data, (await page(2)).body.data, (await page(3)).body.data];
    expect(one).toMatchObject({ page: 1, limit: 2, total: 3 });
    expect(one.looks).toHaveLength(2);
    expect(two.looks).toHaveLength(1);
    expect(three).toMatchObject({ looks: [], page: 3, total: 3 });
    const ids = [...one.looks, ...two.looks].map((l: Look) => l.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('rejects an invalid list query with INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('query@example.com');
    for (const query of ['limit=51', 'limit=0', 'page=0', 'status=x', 'status=archived']) {
      const res = await request(app).get(`/v1/outfits?${query}`).set(bearer(token));
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('opens a look (suggested or saved) with no attached items or price summary yet', async () => {
    const { app, token } = await signedIn('open@example.com');
    const [look] = await generate(app, token);

    const suggested = await request(app).get(`/v1/outfits/${look!.id}`).set(bearer(token));
    expect(suggested.status).toBe(200);
    expect(outfitDetailSchema.parse(suggested.body.data)).toEqual({ ...look, userItems: [] });

    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    const saved = await request(app).get(`/v1/outfits/${look!.id}`).set(bearer(token));
    const detail = outfitDetailSchema.parse(saved.body.data);
    expect(detail).toEqual({ ...look, status: 'saved', userItems: [] });
    expect(saved.body.data).not.toHaveProperty('priceSummary');
    expect(saved.body.warnings).toBeUndefined();
  });

  it('T-04 another user’s look is NOT_FOUND on get, save and delete, and never listed', async () => {
    const { app, mail } = env.makeApp({}, { styleLibrary });
    await registerUser(app, env, mail, 'owner@example.com');
    await registerUser(app, env, mail, 'other@example.com');
    const owner = await login(app, 'owner@example.com');
    const other = await login(app, 'other@example.com');
    const [look] = await generate(app, owner);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(owner)).expect(200);

    for (const id of [look!.id, ID_NOBODY_HAS]) {
      for (const res of [
        await request(app).get(`/v1/outfits/${id}`).set(bearer(other)),
        await request(app).post(`/v1/outfits/${id}/save`).set(bearer(other)),
        await request(app).delete(`/v1/outfits/${id}`).set(bearer(other)),
      ]) {
        expect(res.status).toBe(404);
        expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Not found' });
      }
    }
    for (const status of ['saved', 'suggested']) {
      const list = await request(app).get(`/v1/outfits?status=${status}`).set(bearer(other));
      expect(list.body.data).toEqual({ looks: [], page: 1, limit: 20, total: 0 });
    }
    // Untouched for its owner.
    const stored = await env.db.models.Outfit.findById(look!.id).lean();
    expect(stored!.status).toBe('saved');
  });

  it('rejects a malformed look ID with INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('badid@example.com');
    for (const id of ['abc', '64B7F0C2A1B2C3D4E5F60718', `${ID_NOBODY_HAS}0`]) {
      for (const res of [
        await request(app).get(`/v1/outfits/${id}`).set(bearer(token)),
        await request(app).post(`/v1/outfits/${id}/save`).set(bearer(token)),
        await request(app).delete(`/v1/outfits/${id}`).set(bearer(token)),
      ]) {
        expect(res.status, id).toBe(400);
        expect(res.body.error.code).toBe('INVALID_REQUEST');
      }
    }
  });

  it('deletes a look; it is then NOT_FOUND, and deleting again is NOT_FOUND', async () => {
    const { app, token } = await signedIn('delete@example.com');
    const [look, other] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);

    const res = await request(app).delete(`/v1/outfits/${look!.id}`).set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ deleted: true });
    expect((await request(app).get(`/v1/outfits/${look!.id}`).set(bearer(token))).body.error.code).toBe('NOT_FOUND');
    expect((await request(app).delete(`/v1/outfits/${look!.id}`).set(bearer(token))).body.error.code).toBe('NOT_FOUND');
    expect(await env.db.models.Outfit.exists({ _id: new Types.ObjectId(look!.id) })).toBeNull();
    // Only that look was removed.
    if (other) expect(await env.db.models.Outfit.exists({ _id: new Types.ObjectId(other.id) })).not.toBeNull();
  });

  it('account deletion removes the user’s saved looks', async () => {
    const { app, mail } = env.makeApp({}, { styleLibrary });
    await registerUser(app, env, mail, 'gone@example.com');
    const token = await login(app, 'gone@example.com');
    const [look] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    expect(await env.db.models.Outfit.countDocuments({ status: 'saved' })).toBe(1);

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const res = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true });
    expect(res.status).toBe(200);
    expect(await env.db.models.Outfit.countDocuments()).toBe(0);
  });

  it('never logs look contents', async () => {
    const { app, token } = await signedIn('logs@example.com');
    const [look] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    await request(app).get('/v1/outfits').set(bearer(token));
    await request(app).get(`/v1/outfits/${look!.id}`).set(bearer(token));
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).not.toContain(look!.explanation);
    expect(logs).not.toContain(look!.slots[0]!.searchPhrase);
  });
});

// One save system (D-116, mechanism agreed on #41): a saved look also has one `savedItems` entry.
describe('saved looks in the shared save system (D-116)', () => {
  const entries = (userId?: Types.ObjectId) => env.db.models.SavedItem.find(userId ? { userId } : {}).lean();

  async function userIdOf(email: string) {
    return (await env.db.models.User.findOne({ email }).lean())!._id;
  }

  it('saving creates exactly one entry with the agreed fields; saving again keeps one', async () => {
    const { app, token } = await signedIn('mirror@example.com');
    const [look] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);

    const items = await entries(await userIdOf('mirror@example.com'));
    expect(items).toHaveLength(1);
    const item = items[0]!;
    const template = styleLibrary.getTemplate(look!.templateId)!;
    const palette = styleLibrary.getPalette(look!.paletteId)!;
    expect(item).toMatchObject({
      itemType: 'outfit',
      sourceFeature: 'discover_my_style',
      ref: { kind: 'look', id: look!.id },
      identityKey: lookIdentityKey(look!.id),
      name: `Everyday look: ${template.name}`.slice(0, 80),
      notes: null,
      isFavourite: false,
      collectionIds: [],
      customization: null,
      derivedFromId: null,
      origin: { templateId: look!.templateId, paletteId: look!.paletteId },
      recommendationContext: {
        explanation: look!.explanation,
        ruleIds: look!.explanationRefs.ruleIds,
        attributes: look!.explanationRefs.attributes,
      },
    });
    expect(item.snapshot).toEqual({
      templateName: template.name,
      paletteName: palette.name,
      slots: look!.slots.map((s) => ({ slotId: s.slotId, category: s.lookSpec.category, swatches: s.swatches })),
    });
    expect(item.facets).toEqual({
      occasions: ['everyday'],
      styles: [],
      categories: [...new Set(look!.slots.map((s) => s.lookSpec.category))],
      colorIds: [...new Set(look!.slots.flatMap((s) => s.swatches.map((w) => w.colorId)))],
    });
    // A reference plus a minimum snapshot, never a copy of the look (D-116).
    expect(item.snapshot).not.toHaveProperty('explanation');
  });

  it('deleting a saved look removes both records and detaches the user’s shortlist items', async () => {
    const { app, token } = await signedIn('both@example.com');
    const [look] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    const userId = await userIdOf('both@example.com');
    // Attaching arrives with #43, so the attached item is written directly.
    const item = await env.db.models.ShortlistItem.create({
      userId,
      outfitId: new Types.ObjectId(look!.id),
      slotId: look!.slots[0]!.slotId,
      name: 'Navy kurta',
      priceEntered: 1299,
    });

    await request(app).delete(`/v1/outfits/${look!.id}`).set(bearer(token)).expect(200);
    expect(await env.db.models.Outfit.exists({ _id: new Types.ObjectId(look!.id) })).toBeNull();
    expect(await entries(userId)).toHaveLength(0);
    const kept = await env.db.models.ShortlistItem.findById(item._id).lean();
    expect(kept).toMatchObject({ outfitId: null, slotId: null, name: 'Navy kurta' });
  });

  it('when the entry cannot be written, save returns an error and a retry completes it', async () => {
    const { app, token } = await signedIn('retry@example.com');
    const [look] = await generate(app, token);
    const spy = vi.spyOn(env.db.models.SavedItem, 'updateOne').mockRejectedValueOnce(new Error('write failed'));
    const failed = await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token));
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe('INTERNAL_ERROR');
    spy.mockRestore();

    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    expect(await entries(await userIdOf('retry@example.com'))).toHaveLength(1);
  });

  it('another user’s look never gets an entry', async () => {
    const owner = await signedIn('owner@example.com');
    const [look] = await generate(owner.app, owner.token);
    const intruder = await signedIn('intruder@example.com');

    const res = await request(intruder.app).post(`/v1/outfits/${look!.id}/save`).set(bearer(intruder.token));
    expect(res.status).toBe(404);
    expect(await entries()).toHaveLength(0);
  });

  it('a new save beyond 1,000 saved items is CONFLICT and the look stays suggested', async () => {
    const { app, token } = await signedIn('full@example.com');
    const [look, second] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    const userId = await userIdOf('full@example.com');
    await env.db.models.SavedItem.insertMany(
      Array.from({ length: SAVED_LIMITS.itemsPerUser - 1 }, (_, i) => ({
        userId,
        itemType: 'clothing_style',
        sourceFeature: 'outfit_categories',
        ref: { kind: 'clothing_style', id: `CST-${String(i).padStart(4, '0')}` },
        identityKey: `seed-${i}`,
        name: `Style ${i}`,
      })),
    );

    const res = await request(app).post(`/v1/outfits/${second!.id}/save`).set(bearer(token));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    const stored = await env.db.models.Outfit.findById(second!.id).lean();
    expect(stored?.status).toBe('suggested');
    expect(stored?.expiresAt).toBeInstanceOf(Date);
    // Re-saving a look that already has its entry is not a new save.
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
  });

  it('account deletion clears saved looks and their entries', async () => {
    const { app, mail } = env.makeApp({}, { styleLibrary });
    await registerUser(app, env, mail, 'wipe@example.com');
    const token = await login(app, 'wipe@example.com');
    const [look] = await generate(app, token);
    await request(app).post(`/v1/outfits/${look!.id}/save`).set(bearer(token)).expect(200);
    expect(await entries()).toHaveLength(1);

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('wipe@example.com'), confirm: true })
      .expect(200);
    expect(await env.db.models.Outfit.countDocuments()).toBe(0);
    expect(await entries()).toHaveLength(0);
  });
});
