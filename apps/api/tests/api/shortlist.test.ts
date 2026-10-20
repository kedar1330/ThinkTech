import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHORTLIST_LIMITS, shortlistListResponseSchema, userShortlistItemSchema } from '@styleme/contracts';
import { replayTombstones } from '../../src/services/account-deletion';
import {
  BASE_CONFIG,
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

async function signedIn(email: string) {
  const { app, mail } = env.makeApp();
  const { id } = await registerUser(app, env, mail, email);
  return { app, mail, token: await login(app, email), userId: new Types.ObjectId(id) };
}

type App = Parameters<typeof request>[0];
const add = (app: App, token: string, body: object) => request(app).post('/v1/shortlist').set(bearer(token)).send(body);
const list = (app: App, token: string, query = '') => request(app).get(`/v1/shortlist${query}`).set(bearer(token));

// Tracking parameters, mixed case and a fragment: all must come back exactly as typed (FR-LIST-05).
const LINK = 'https://Shop.example/kurtas/Indigo-Kurta?utm_source=friend&ref=abc&size=M#details';
const ITEM = { name: 'Indigo cotton kurta', priceEntered: 1299.5, url: LINK, note: 'Ask about the dupatta' };

describe('/v1/shortlist (FR-LIST, API.md §3.6)', () => {
  it('requires a signed-in user', async () => {
    const { app } = env.makeApp();
    const id = new Types.ObjectId().toHexString();
    for (const res of [
      await request(app).get('/v1/shortlist'),
      await request(app).post('/v1/shortlist').send(ITEM),
      await request(app).delete(`/v1/shortlist/${id}`),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('a Google sign-up must create a password first (withPassword)', async () => {
    const { app } = env.makeApp();
    await invite(env, 'gs@gmail.com');
    const google = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-38', email: 'gs@gmail.com' }), intent: 'signup', acceptTerms: true });
    const token = google.body.data.accessToken as string;
    expect((await list(app, token)).body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
    expect((await add(app, token, ITEM)).body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
  });

  it('B-01 an added item is returned as the user’s own, unverified entry with USER_ENTERED_PRICES', async () => {
    const { app, token, userId } = await signedIn('b01@example.com');
    const res = await add(app, token, ITEM);
    expect(res.status).toBe(201);
    expect(res.body.warnings).toEqual(['USER_ENTERED_PRICES']);
    const item = userShortlistItemSchema.parse(res.body.data);
    expect(item).toMatchObject({
      ...ITEM,
      currency: 'INR',
      priceBasis: 'user_entered',
      verifiedByStyleMe: false,
      outfitId: null,
      slotId: null,
    });

    const stored = await env.db.models.ShortlistItem.findById(item.id).lean();
    expect(String(stored!.userId)).toBe(String(userId));
    expect(stored).toMatchObject({ priceBasis: 'user_entered', currency: 'INR', url: LINK });

    const listed = await list(app, token);
    expect(listed.status).toBe(200);
    expect(listed.body.warnings).toEqual(['USER_ENTERED_PRICES']);
    expect(shortlistListResponseSchema.parse(listed.body.data)).toEqual({
      items: [item],
      page: 1,
      limit: 20,
      total: 1,
    });
  });

  it('optional fields can be left out; an empty list carries no warning', async () => {
    const { app, token } = await signedIn('min@example.com');
    const empty = await list(app, token);
    expect(empty.body).toEqual({ success: true, data: { items: [], page: 1, limit: 20, total: 0 } });

    const res = await add(app, token, { name: '  Silver jhumkas  ', priceEntered: 450, note: '   ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Silver jhumkas', priceEntered: 450, url: null, note: null });
  });

  it('B-02 rejects bad links and values outside the FR-LIST-07 limits with INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('b02@example.com');
    const longLink = `https://shop.example/${'a'.repeat(SHORTLIST_LIMITS.urlMax)}`;
    for (const body of [
      {},
      { priceEntered: 100 },
      { name: 'Kurta' },
      { ...ITEM, url: 'http://shop.example/kurta' },
      { ...ITEM, url: 'javascript:alert(1)' },
      { ...ITEM, url: 'data:text/html,<script>alert(1)</script>' },
      { ...ITEM, url: 'ftp://shop.example/kurta' },
      { ...ITEM, url: 'shop.example/kurta' },
      { ...ITEM, url: longLink },
      { ...ITEM, name: '' },
      { ...ITEM, name: '   ' },
      { ...ITEM, name: 'n'.repeat(SHORTLIST_LIMITS.nameMax + 1) },
      { ...ITEM, note: 'n'.repeat(SHORTLIST_LIMITS.noteMax + 1) },
      { ...ITEM, priceEntered: 0 },
      { ...ITEM, priceEntered: -10 },
      { ...ITEM, priceEntered: SHORTLIST_LIMITS.priceMax + 1 },
      { ...ITEM, priceEntered: 10.005 },
      { ...ITEM, priceEntered: '1299' },
      // No retailer, category, image or verified fields exist for user-entered items (FR-LIST-03).
      { ...ITEM, category: 'top' },
      { ...ITEM, priceInr: 1299 },
      { ...ITEM, currency: 'INR' },
      { ...ITEM, imageUrl: 'https://shop.example/kurta.jpg' },
      { ...ITEM, retailer: 'Some Shop' },
      { ...ITEM, verifiedByStyleMe: true },
    ]) {
      const res = await add(app, token, body);
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect(await env.db.models.ShortlistItem.countDocuments()).toBe(0);
  });

  it('B-02 accepts values at the limits', async () => {
    const { app, token } = await signedIn('edge@example.com');
    const longest = `https://shop.example/${'a'.repeat(SHORTLIST_LIMITS.urlMax - 'https://shop.example/'.length)}`;
    for (const body of [
      { name: 'n'.repeat(SHORTLIST_LIMITS.nameMax), priceEntered: SHORTLIST_LIMITS.priceMax },
      { name: 'Bindi pack', priceEntered: 0.01, note: 'n'.repeat(SHORTLIST_LIMITS.noteMax) },
      { name: 'Long link', priceEntered: 99.99, url: longest },
    ]) {
      const res = await add(app, token, body);
      expect(res.status, JSON.stringify(body).slice(0, 120)).toBe(201);
    }
    expect((await list(app, token)).body.data.items[0].url).toBe(longest);
  });

  it('B-02 / AC-B2 a link is stored and returned unchanged and never requested', async () => {
    const { app, token } = await signedIn('nofetch@example.com');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const created = await add(app, token, ITEM);
      expect(created.status).toBe(201);
      expect(created.body.data.url).toBe(LINK);
      expect((await env.db.models.ShortlistItem.findById(created.body.data.id).lean())!.url).toBe(LINK);
      expect((await list(app, token)).body.data.items[0].url).toBe(LINK);
      await request(app).delete(`/v1/shortlist/${created.body.data.id}`).set(bearer(token)).expect(200);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('lists newest first, paginated (default 20, maximum 50)', async () => {
    const { app, token } = await signedIn('pages@example.com');
    for (const n of [1, 2, 3, 4, 5]) await add(app, token, { name: `Item ${n}`, priceEntered: n * 100 }).expect(201);

    const first = await list(app, token, '?limit=2');
    expect(first.body.data).toMatchObject({ page: 1, limit: 2, total: 5 });
    expect(first.body.data.items.map((i: { name: string }) => i.name)).toEqual(['Item 5', 'Item 4']);
    const last = await list(app, token, '?limit=2&page=3');
    expect(last.body.data.items.map((i: { name: string }) => i.name)).toEqual(['Item 1']);
    const beyond = await list(app, token, '?limit=2&page=4');
    expect(beyond.body.data).toMatchObject({ items: [], total: 5 });
    expect(beyond.body.warnings).toBeUndefined();

    for (const query of ['?limit=51', '?limit=0', '?page=0', '?page=x', '?sort=price', '?outfitId=nope']) {
      const res = await list(app, token, query);
      expect(res.status, query).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('filters by outfitId to the items attached to that look', async () => {
    const { app, token, userId } = await signedIn('filter@example.com');
    await add(app, token, ITEM).expect(201);
    // Attaching arrives with #43; until then an attached item can only exist in the database.
    const outfitId = new Types.ObjectId();
    await env.db.models.ShortlistItem.create({ userId, outfitId, slotId: 'top', name: 'Top', priceEntered: 800 });

    const res = await list(app, token, `?outfitId=${outfitId.toHexString()}`);
    const data = shortlistListResponseSchema.parse(res.body.data);
    expect(data.total).toBe(1);
    expect(data.items[0]).toMatchObject({ name: 'Top', outfitId: outfitId.toHexString(), slotId: 'top' });
    expect((await list(app, token, `?outfitId=${new Types.ObjectId().toHexString()}`)).body.data.total).toBe(0);
  });

  it('B-03 another user’s items are never listed, and deleting one is NOT_FOUND', async () => {
    const a = await signedIn('owner@example.com');
    const b = await signedIn('other@example.com');
    const created = await add(a.app, a.token, ITEM);
    const id = created.body.data.id as string;

    expect((await list(b.app, b.token)).body.data).toEqual({ items: [], page: 1, limit: 20, total: 0 });
    const outfitFilter = await list(b.app, b.token, `?outfitId=${new Types.ObjectId().toHexString()}`);
    expect(outfitFilter.body.data.total).toBe(0);

    const res = await request(b.app).delete(`/v1/shortlist/${id}`).set(bearer(b.token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await env.db.models.ShortlistItem.countDocuments({ _id: id })).toBe(1);
    expect((await list(a.app, a.token)).body.data.total).toBe(1);
  });

  it('deletes the user’s item once; a second delete or an unknown ID is NOT_FOUND', async () => {
    const { app, token } = await signedIn('del@example.com');
    const id = (await add(app, token, ITEM)).body.data.id as string;
    const del = await request(app).delete(`/v1/shortlist/${id}`).set(bearer(token));
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ success: true, data: { deleted: true } });
    expect((await list(app, token)).body.data.total).toBe(0);

    for (const target of [id, new Types.ObjectId().toHexString()]) {
      const again = await request(app).delete(`/v1/shortlist/${target}`).set(bearer(token));
      expect(again.status).toBe(404);
      expect(again.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('a malformed item ID is INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('badid@example.com');
    for (const id of ['not-an-id', '123', 'ABCDEFABCDEFABCDEFABCDEF', `${'a'.repeat(24)}x`]) {
      const res = await request(app).delete(`/v1/shortlist/${id}`).set(bearer(token));
      expect(res.status, id).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('B-03 the 201st item is CONFLICT; removing one makes room again', async () => {
    const { app, token, userId } = await signedIn('full@example.com');
    const other = await signedIn('room@example.com');
    await env.db.models.ShortlistItem.insertMany(
      Array.from({ length: SHORTLIST_LIMITS.itemsPerUser }, (_, n) => ({
        userId,
        name: `Item ${n}`,
        priceEntered: 100,
      })),
    );

    const res = await add(app, token, ITEM);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(/up to 200 items/);
    expect(await env.db.models.ShortlistItem.countDocuments({ userId })).toBe(SHORTLIST_LIMITS.itemsPerUser);
    // The limit is per user.
    await add(other.app, other.token, ITEM).expect(201);

    await env.db.models.ShortlistItem.deleteOne({ userId });
    await add(app, token, ITEM).expect(201);
  });

  it('B-10 several unattached items are accepted; a half-attachment is INVALID_REQUEST', async () => {
    const { app, token } = await signedIn('b10@example.com');
    for (const n of [1, 2, 3]) await add(app, token, { name: `Accessory ${n}`, priceEntered: 250 }).expect(201);

    const outfitId = new Types.ObjectId().toHexString();
    for (const body of [
      { ...ITEM, outfitId },
      { ...ITEM, slotId: 'top' },
      { ...ITEM, outfitId: 'nope', slotId: 'top' },
      { ...ITEM, outfitId, slotId: 'Not A Slot' },
    ]) {
      const res = await add(app, token, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect((await list(app, token)).body.data.total).toBe(3);
  });

  it('attaching an item to a look at creation is not available yet (#43)', async () => {
    const { app, token } = await signedIn('attach@example.com');
    const res = await add(app, token, { ...ITEM, outfitId: new Types.ObjectId().toHexString(), slotId: 'top' });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'INVALID_REQUEST',
      message: 'Adding an item to a look is not available yet',
    });
    expect(await env.db.models.ShortlistItem.countDocuments()).toBe(0);
  });

  it('B-08 account deletion removes the items, and tombstone replay removes them from a restored copy', async () => {
    const { app, mail, token, userId } = await signedIn('gone@example.com');
    const keep = await signedIn('keep@example.com');
    await add(app, token, ITEM).expect(201);
    await add(app, token, { name: 'Juttis', priceEntered: 1500 }).expect(201);
    await add(keep.app, keep.token, ITEM).expect(201);
    const restored = env.db.main.useDb('styleme_restored_shortlist');
    await restored
      .collection('shortlistItems')
      .insertMany(await env.db.main.collection('shortlistItems').find().toArray());

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const res = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('gone@example.com'), confirm: true });
    expect(res.status).toBe(200);
    expect(await env.db.models.ShortlistItem.countDocuments({ userId })).toBe(0);
    expect(await env.db.models.ShortlistItem.countDocuments({ userId: keep.userId })).toBe(1);

    const report = await replayTombstones(env.db.models, restored, BASE_CONFIG.TOMBSTONE_HMAC_KEY);
    expect(report.ok).toBe(true);
    expect(await restored.collection('shortlistItems').countDocuments({ userId })).toBe(0);
    expect(await restored.collection('shortlistItems').countDocuments({ userId: keep.userId })).toBe(1);
    await restored.dropDatabase();
  });

  it('never logs item names, notes or links', async () => {
    const { app, token } = await signedIn('logs@example.com');
    await add(app, token, ITEM).expect(201);
    await add(app, token, { ...ITEM, url: 'http://insecure.example/x' }).expect(400);
    await list(app, token).expect(200);
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).not.toMatch(/Indigo|dupatta|Shop\.example|insecure\.example|utm_source/);
  });
});
