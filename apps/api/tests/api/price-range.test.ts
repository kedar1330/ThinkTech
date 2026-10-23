import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  PRICE_RANGE_LABEL,
  PRODUCTS_PER_STORE,
  PRODUCT_MATCHES_LABEL,
  lookPicksResponseSchema,
  lookPriceRangeSchema,
  lookProductMatchesSchema,
  lookSchema,
  type Look,
  type ProductListing,
} from '@styleme/contracts';
import { PRICE_SEARCH_TTL_MS, parseInr, storeOf } from '../../src/services/price-range.service';
import { loadStyleLibrary } from '../../src/style-rules';
import { FakeShoppingProvider, listing } from '../fixtures/shopping';
import { categoryQuery } from '../../src/services/listing-match';
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
    // Price text, price fields, store names and listing titles; not bare digits, which also occur in request
    // IDs and timings.
    expect(logs).not.toMatch(/₹|Rs\. ?\d|"price"|Amazon\.in|Flipkart|Meesho|Synthetic /);
    expect(logs).toContain('price_search_failed');
  });
});

describe('GET /v1/outfits/:id/products (#120)', () => {
  it('lists each store’s cheapest listings per garment with its own title, cheapest first, and price stats', async () => {
    const shopping = new FakeShoppingProvider();
    shopping.reply = {
      kind: 'listings',
      listings: [
        listing('Amazon.in', '₹1,299.00', 'Synthetic navy kurta A'),
        listing('Amazon.in', '₹699', 'Synthetic navy kurta B'),
        listing('Amazon.in', '₹899', 'Synthetic navy kurta C'),
        listing('Flipkart', '₹449', 'Synthetic navy kurta D'),
        listing('Meesho', '₹299', 'Synthetic navy kurta E'),
        listing('Myntra', '₹199', 'Synthetic navy kurta F'),
      ],
    };
    const { app, token } = await signedIn('products@example.com', shopping);
    const look = await firstLook(app, token);

    const res = await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token));
    expect(res.status).toBe(200);
    const matches = lookProductMatchesSchema.parse(res.body.data);
    expect(matches.label).toBe(PRODUCT_MATCHES_LABEL);
    const garments = look.slots.filter((s) => GARMENTS.has(s.slot));
    expect(matches.slots.map((s) => s.slotId)).toEqual(garments.map((s) => s.slotId));
    for (const slot of matches.slots) {
      // Each search keeps only its own store, so the fake's listings count once per store; Myntra is left out.
      expect(slot.listings.map((l) => [l.store, l.price, l.title])).toEqual([
        ['meesho', 299, 'Synthetic navy kurta E'],
        ['flipkart', 449, 'Synthetic navy kurta D'],
        ['amazon', 699, 'Synthetic navy kurta B'],
        ['amazon', 899, 'Synthetic navy kurta C'],
        ['amazon', 1299, 'Synthetic navy kurta A'],
      ]);
      expect(slot.stats).toEqual([
        { store: 'amazon', listings: 3, min: 699, median: 899, max: 1299 },
        { store: 'flipkart', listings: 1, min: 449, median: 449, max: 449 },
        { store: 'meesho', listings: 1, min: 299, median: 299, max: 299 },
      ]);
    }
    // The same cached searches serve the price range: no new searches.
    const searched = shopping.queries.length;
    await priceRange(app, token, look.id).expect(200);
    expect(shopping.queries).toHaveLength(searched);
  });

  it(`returns at most ${PRODUCTS_PER_STORE} per store, and passes on only Google Shopping links and Google thumbnails`, async () => {
    const shopping = new FakeShoppingProvider();
    const many = Array.from({ length: 12 }, (_, i) => listing('Amazon.in', `₹${500 + i}`, `Synthetic item ${i}`));
    const unsafe = [
      {
        ...listing('Amazon.in', '₹100', 'Synthetic bad link'),
        link: 'javascript:alert(1)',
        imageUrl: 'http://evil.example/x.png',
      },
      {
        ...listing('Amazon.in', '₹120', 'Synthetic other host'),
        link: 'https://evil.example/',
        imageUrl: 'https://evil.example/x.png',
      },
      { ...listing('Amazon.in', '₹130', 'Synthetic no title'), title: '   ' },
    ];
    shopping.reply = { kind: 'listings', listings: [...many, ...unsafe] };
    const { app, token } = await signedIn('safe-products@example.com', shopping);
    const look = await firstLook(app, token);
    const matches = lookProductMatchesSchema.parse(
      (await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token))).body.data,
    );
    const slot = matches.slots[0]!;
    expect(slot.listings).toHaveLength(PRODUCTS_PER_STORE);
    expect(slot.listings.map((l) => l.title)).not.toContain('Synthetic no title');
    const bad = slot.listings.filter(
      (l) => l.title.startsWith('Synthetic bad') || l.title.startsWith('Synthetic other'),
    );
    expect(bad).toHaveLength(2);
    for (const l of bad) expect([l.link, l.imageUrl]).toEqual([null, null]);
    expect(slot.stats[0]).toMatchObject({ store: 'amazon', listings: 14 });
  });

  it('is owner-only and unavailable without a key', async () => {
    const shopping = new FakeShoppingProvider();
    const owner = await signedIn('owner-products@example.com', shopping);
    const look = await firstLook(owner.app, owner.token);
    const other = await signedIn('other-products@example.com', shopping);
    expect((await request(other.app).get(`/v1/outfits/${look.id}/products`).set(bearer(other.token))).status).toBe(404);
    const off = await signedIn('off-products@example.com');
    const offLook = await firstLook(off.app, off.token);
    const res = await request(off.app).get(`/v1/outfits/${offLook.id}/products`).set(bearer(off.token));
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});

/** The listing as a pick request sends it: without the `matched` attributes (#133). */
const asListing = ({ store, title, price, link, imageUrl }: ProductListing): ProductListing => ({
  store,
  title,
  price,
  link,
  imageUrl,
});

describe('picks (PUT/GET/DELETE /v1/outfits/:id/picks, #120)', () => {
  async function withProducts(email: string) {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn(email, shopping);
    const look = await firstLook(app, token);
    const matches = lookProductMatchesSchema.parse(
      (await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token))).body.data,
    );
    return { app, token, look, matches };
  }

  it('saves one pick per garment on the look, replaces it, and removes it', async () => {
    const { app, token, look, matches } = await withProducts('picks@example.com');
    const [first, second] = matches.slots[0]!.listings;
    const slotId = matches.slots[0]!.slotId;

    const put = await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId, listing: asListing(first!) });
    expect(put.status).toBe(200);
    expect(lookPicksResponseSchema.parse(put.body.data).picks).toEqual([
      { ...asListing(first!), slotId, pickedAt: expect.any(String) },
    ]);
    const stored = await env.db.models.Outfit.findById(look.id).lean();
    expect(stored!.shopPicks).toHaveLength(1);

    await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId, listing: asListing(second!) })
      .expect(200);
    const list = lookPicksResponseSchema.parse(
      (await request(app).get(`/v1/outfits/${look.id}/picks`).set(bearer(token))).body.data,
    );
    expect(list.picks.map((p) => [p.slotId, p.title])).toEqual([[slotId, second!.title]]);

    const del = await request(app).delete(`/v1/outfits/${look.id}/picks/${slotId}`).set(bearer(token));
    expect(lookPicksResponseSchema.parse(del.body.data).picks).toEqual([]);
  });

  it('never saves a made-up product: the listing must be one the search returned for that garment', async () => {
    const { app, token, look, matches } = await withProducts('fake-pick@example.com');
    const slot = matches.slots[0]!;
    const made = { ...asListing(slot.listings[0]!), price: 1 };
    const res = await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId: slot.slotId, listing: made });
    expect(res.status).toBe(404);
    const wrongSlot = await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId: 'shoes', listing: asListing(slot.listings[0]!) });
    expect(wrongSlot.body.error.code).toBe('INVALID_REQUEST');
    const bad = await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId: slot.slotId, listing: { title: 'x' } });
    expect(bad.body.error.code).toBe('INVALID_REQUEST');
    expect((await env.db.models.Outfit.findById(look.id).lean())!.shopPicks).toEqual([]);
  });

  it('T-04 another user can neither read nor change the picks', async () => {
    const { app, look, matches } = await withProducts('pick-owner@example.com');
    const other = await signedIn('pick-other@example.com', new FakeShoppingProvider());
    const slot = matches.slots[0]!;
    expect((await request(other.app).get(`/v1/outfits/${look.id}/picks`).set(bearer(other.token))).status).toBe(404);
    expect(
      (
        await request(other.app)
          .put(`/v1/outfits/${look.id}/picks`)
          .set(bearer(other.token))
          .send({ slotId: slot.slotId, listing: asListing(slot.listings[0]!) })
      ).status,
    ).toBe(404);
    expect(
      (await request(other.app).delete(`/v1/outfits/${look.id}/picks/${slot.slotId}`).set(bearer(other.token))).status,
    ).toBe(404);
    expect((await request(app).get(`/v1/outfits/${look.id}/picks`)).status).toBe(401);
  });
});

describe('matches first, then other styles (GET /v1/outfits/:id/products, #133)', () => {
  it('ranks items by how much of the look their title mentions, then lists other styles of the same garment', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('matches@example.com', shopping);
    const look = await firstLook(app, token);
    const garment = look.slots.find((s) => GARMENTS.has(s.slot))!;
    const colour = garment.swatches[0]!.name;
    const category = CATEGORIES.find((c) => c.id === garment.lookSpec.category)!.label;
    const broad = categoryQuery(garment.lookSpec, 'women');
    shopping.respond = (query) => {
      if (query === broad || query.startsWith(`${broad} `)) {
        return [
          listing('Amazon.in', '₹350', `Synthetic striped ${category} B`),
          listing('Amazon.in', '₹500', `Synthetic ${colour} ${category} with everything`), // also a match: left out
          listing('Amazon.in', '₹350', `Synthetic striped ${category} B`), // repeated in the reply
        ];
      }
      if (query.endsWith(' flipkart') || query.endsWith(' meesho')) return [];
      return [
        listing('Amazon.in', '₹300', `Synthetic ${category}`),
        listing('Amazon.in', '₹900', `Synthetic ${colour} ${category} with everything`),
      ];
    };

    const matches = lookProductMatchesSchema.parse(
      (await request(app).get(`/v1/outfits/${look.id}/products`).set(bearer(token))).body.data,
    );
    const slot = matches.slots.find((s) => s.slotId === garment.slotId)!;
    // The colour match ranks first although it costs more.
    expect(slot.listings.map((l) => [l.title, l.matched])).toEqual([
      [`Synthetic ${colour} ${category} with everything`, ['category', 'color']],
      [`Synthetic ${category}`, ['category']],
    ]);
    // Other styles: same garment, never a match again, no repeats.
    expect(slot.alternatives.map((l) => l.title)).toEqual([`Synthetic striped ${category} B`]);
    // The broad searches carry the category and department only.
    expect(shopping.queries).toEqual(expect.arrayContaining([broad, `${broad} flipkart`, `${broad} meesho`]));

    // Another style can be saved like a match.
    const alt = slot.alternatives[0]!;
    const saved = await request(app)
      .put(`/v1/outfits/${look.id}/picks`)
      .set(bearer(token))
      .send({ slotId: slot.slotId, listing: alt });
    expect(saved.status).toBe(200);
    expect(lookPicksResponseSchema.parse(saved.body.data).picks.map((p) => p.title)).toEqual([alt.title]);
  });

  it('price ranges keep to the matching searches (no broad searches)', async () => {
    const shopping = new FakeShoppingProvider();
    const { app, token } = await signedIn('range-only@example.com', shopping);
    const look = await firstLook(app, token);
    await priceRange(app, token, look.id).expect(200);
    const garments = look.slots.filter((s) => GARMENTS.has(s.slot));
    expect(shopping.queries).toHaveLength(garments.length * 3);
  });
});
