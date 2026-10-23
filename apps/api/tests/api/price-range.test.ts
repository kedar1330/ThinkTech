import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PRICE_RANGE_LABEL, lookPriceRangeSchema, lookSchema, type Look } from '@styleme/contracts';
import { PRICE_SEARCH_TTL_MS, parseInr, storeOf } from '../../src/services/price-range.service';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeShoppingProvider, listing } from '../fixtures/shopping';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Price ranges on Shop My Look tabs (GET /v1/outfits/:id/price-range, #118). Listings come from a fake
// store search provider with synthetic listings; nothing reaches Serper.dev.

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

async function signedIn(email: string, shopping?: FakeShoppingProvider) {
  const { app, mail } = env.makeApp({}, { styleLibrary, shopping });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
  return { app, token };
}

async function firstLook(app: Express, token: string): Promise<Look> {
  const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
  expect(res.status).toBe(200);
  return lookSchema.parse(res.body.data.looks[0]);
}

const priceRange = (app: Express, token: string, id: string) =>
  request(app).get(`/v1/outfits/${id}/price-range`).set(bearer(token));

describe('price parsing and store matching', () => {
  it('reads the first rupee amount and ignores noise', () => {
    expect(parseInr('₹1,299.00')).toBe(1299);
    expect(parseInr('₹4999')).toBe(4999);
    expect(parseInr('Rs. 449')).toBe(449);
    expect(parseInr('₹1,24,999')).toBe(124999);
    expect(parseInr('₹499.50 – ₹699')).toBe(499.5);
    expect(parseInr('Free')).toBeNull();
    expect(parseInr('₹5')).toBeNull();
  });

  it('keeps Amazon, Flipkart and Meesho only', () => {
    expect(storeOf('Amazon.in')).toBe('amazon');
    expect(storeOf('Flipkart - Retailnet')).toBe('flipkart');
    expect(storeOf('Meesho')).toBe('meesho');
    expect(storeOf('Myntra')).toBeNull();
  });
});

describe('GET /v1/outfits/:id/price-range (#118)', () => {
  it('prices each garment from Amazon, Flipkart and Meesho listings only, with the label', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('range@example.com', shopping);
    const look = await firstLook(app, token);

    const res = await priceRange(app, token, look.id);
    expect(res.status).toBe(200);
    const range = lookPriceRangeSchema.parse(res.body.data);
    const garments = look.slots.filter((s) => GARMENTS.has(s.slot));
    expect(range.totalSlots).toBe(garments.length);
    expect(range.slots.map((s) => s.slotId)).toEqual(garments.map((s) => s.slotId));
    // The fake returns the same four listings for every search. Each search keeps only its own store, so the
    // three searches give one Amazon, one Flipkart and one Meesho price (not nine); Myntra's ₹2,499 is left out.
    for (const slot of range.slots) {
      expect(slot).toEqual({
        slotId: slot.slotId,
        min: 449,
        max: 1299,
        listings: 3,
        stores: ['amazon', 'flipkart', 'meesho'],
      });
    }
    expect(range).toMatchObject({
      currency: 'INR',
      priceBasis: 'search_results',
      min: 449 * garments.length,
      max: 1299 * garments.length,
      pricedSlots: garments.length,
      stores: ['amazon', 'flipkart', 'meesho'],
      label: PRICE_RANGE_LABEL,
    });
  });

  it('searches with the garment and department only, never anything about the user', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('private-range@example.com', shopping);
    await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', heightCm: 168, sizes: { bottoms: { waistIn: 30 } } })
      .expect(200);
    const look = await firstLook(app, token);
    await priceRange(app, token, look.id).expect(200);

    const garments = look.slots.filter((s) => GARMENTS.has(s.slot));
    // Three searches per garment: plain (Amazon), then naming Flipkart and Meesho.
    expect([...shopping.queries].sort()).toEqual(
      garments
        .flatMap((s) => {
          const base = `${s.searchPhrase} women`.toLowerCase();
          return [base, `${base} flipkart`, `${base} meesho`];
        })
        .sort(),
    );
    for (const q of shopping.queries) expect(q).not.toMatch(/168|waist|30 ?in|skin|undertone|body|private-range/i);
  });

  it('reuses cached listings for a day, then searches again', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('cache@example.com', shopping);
    const look = await firstLook(app, token);
    await priceRange(app, token, look.id).expect(200);
    const searched = shopping.queries.length;
    await priceRange(app, token, look.id).expect(200);
    expect(shopping.queries).toHaveLength(searched);

    const cached = await env.db.models.PriceSearchCache.find().lean();
    expect(cached).toHaveLength(new Set(shopping.queries).size);
    for (const entry of cached) {
      expect(entry).not.toHaveProperty('userId');
      expect(entry.expiresAt.getTime() - entry.checkedAt.getTime()).toBe(PRICE_SEARCH_TTL_MS);
    }
    await env.db.models.PriceSearchCache.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await priceRange(app, token, look.id).expect(200);
    expect(shopping.queries).toHaveLength(searched * 2);
  });

  it('never guesses: garments without listings have no range, and none at all means no look range', async () => {
    const shopping = new FakeShoppingProvider();
    shopping.reply = { kind: 'listings', listings: [listing('Myntra', '₹999'), listing('Amazon.in', 'See price')] };
    const { app, token } = await signedIn('none@example.com', shopping);
    const look = await firstLook(app, token);
    const range = lookPriceRangeSchema.parse((await priceRange(app, token, look.id)).body.data);
    expect(range).toMatchObject({ min: null, max: null, pricedSlots: 0, stores: [] });
    expect(range.slots.every((s) => s.min === null && s.max === null && s.listings === 0)).toBe(true);
  });

  it('is unavailable without a key, and when the search fails or is rate-limited', async () => {
    const off = await signedIn('off-range@example.com');
    const look = await firstLook(off.app, off.token);
    const res = await priceRange(off.app, off.token, look.id);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');

    const shopping = new FakeShoppingProvider();
    const on = await signedIn('fail-range@example.com', shopping);
    const failing = await firstLook(on.app, on.token);
    shopping.reply = { kind: 'fail', cause: 'timeout' };
    const failed = await priceRange(on.app, on.token, failing.id);
    expect(failed.status).toBe(503);
    expect(failed.body.error.code).toBe('SERVICE_UNAVAILABLE');
    shopping.reply = { kind: 'fail', cause: 'rate_limited' };
    expect((await priceRange(on.app, on.token, failing.id)).body.error.code).toBe('RATE_LIMITED');
    expect(await env.db.models.PriceSearchCache.countDocuments()).toBe(0);
  });

  it('T-04 another user’s look is NOT_FOUND, a malformed ID is INVALID_REQUEST, and sign-in is required', async () => {
    const shopping = new FakeShoppingProvider();
    const owner = await signedIn('owner-range@example.com', shopping);
    const look = await firstLook(owner.app, owner.token);
    const other = await signedIn('other-range@example.com', shopping);

    const res = await priceRange(other.app, other.token, look.id);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect((await priceRange(owner.app, owner.token, 'not-an-id')).body.error.code).toBe('INVALID_REQUEST');
    expect((await request(owner.app).get(`/v1/outfits/${look.id}/price-range`)).status).toBe(401);
    expect(shopping.queries).toHaveLength(0);
  });

  it('never logs queries, listings or prices', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('logs-range@example.com', shopping);
    const look = await firstLook(app, token);
    await priceRange(app, token, look.id).expect(200);
    shopping.reply = { kind: 'fail', cause: 'provider_error' };
    await env.db.models.PriceSearchCache.deleteMany({});
    await priceRange(app, token, look.id).expect(503);

    const logs = logTextForPrivacyChecks(env.logLines);
    for (const slot of look.slots) expect(logs).not.toContain(slot.searchPhrase);
    expect(logs).not.toMatch(/1,?299|449|Amazon\.in|Meesho/);
    expect(logs).toContain('price_search_failed');
  });
});
