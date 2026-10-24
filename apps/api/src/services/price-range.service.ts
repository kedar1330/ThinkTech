import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import {
  PRICE_RANGE_LABEL,
  ALTERNATIVES_PER_STORE,
  PRICE_RANGE_STORE_IDS,
  PRODUCTS_PER_STORE,
  PRODUCT_MATCHES_LABEL,
  type LookInputs,
  type LookPick,
  type LookPriceRange,
  type LookProductMatches,
  type LookSlot,
  type MatchedListing,
  type PickProductRequest,
  type PriceRangeStore,
  type ProductListing,
  type SlotPriceRange,
  type SlotProducts,
  type StorePriceStats,
} from '@styleme/contracts';
import {
  ShoppingProviderError,
  type ShoppingListing,
  type ShoppingSearchProvider,
} from '../integrations/shopping/serper-client';
import type { Models } from '../models/index';
import { categoryQuery, matchedAttributes } from './listing-match';
import { AppError } from '../utils/errors';

// Price ranges (#118) and similar products (#120) on Shop My Look. For each garment of one of the user's own
// looks, the service searches store listings with the garment's search phrase (which carries the design
// features saved in Outfit Categories, D-132) and the department only — never sizes, measurements, photos,
// appearance or anything else about the user. A plain search rarely returns Flipkart or Meesho, so each
// garment gets three searches: the plain one (its Amazon listings are kept) and the same query naming
// Flipkart, then Meesho (only that store's listings are kept), so no listing is counted twice. Only listings
// the provider returned are used, with the store's own title: a garment without listings has no range and
// no products, never guessed ones. Listings are cached per search for a day in `priceSearchCache` (system
// data: the key is the query, no user ID). Queries, listings, prices, links and image URLs are never logged.

/** How long one query's listings are reused. */
export const PRICE_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

/** Bumped when the cached listing shape changes, so older entries are not read. */
const CACHE_VERSION = 'v2';

/** Footwear and accessories are hidden in looks (#111), so only garments are priced. */
const GARMENT_SLOTS = new Set(['layer', 'one_piece', 'top', 'bottom']);

/** Listing prices outside this band are parsing noise or not a garment, and are left out. */
const MIN_PRICE = 50;
const MAX_PRICE = 500_000;
const TITLE_MAX = 200;

const UNAVAILABLE = 'We couldn’t check prices just now. Please try again later.';

interface StoredLook {
  _id: Types.ObjectId;
  slots: LookSlot[];
  inputsUsed?: LookInputs;
}

type CachedListing = ProductListing;

interface Searched {
  slot: LookSlot;
  listings: CachedListing[];
  /** Other styles of the same garment (#133); only searched for the products view. */
  alternatives: CachedListing[];
  checkedAt: Date;
}

/** Amazon, Flipkart or Meesho from a listing's store name (e.g. "Amazon.in", "Flipkart - Seller"). */
export function storeOf(source: string): PriceRangeStore | null {
  const name = source.toLowerCase();
  return PRICE_RANGE_STORE_IDS.find((store) => name.includes(store)) ?? null;
}

/** The first rupee amount in a listing's price text ("₹1,299.00", "Rs. 499", "₹499 – ₹699"), else null. */
export function parseInr(text: string): number | null {
  const match = /(\d[\d,]*(?:\.\d{1,2})?)/.exec(text);
  if (!match) return null;
  const value = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(value) && value >= MIN_PRICE && value <= MAX_PRICE ? value : null;
}

/** An https URL on an allowed host, else null: replies are untrusted, so nothing else is passed on. */
export function safeUrl(raw: string | null, host: (hostname: string) => boolean): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && host(url.hostname) && url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

const googleShopping = (h: string) => h === 'www.google.com';
const googleThumbnail = (h: string) => h.endsWith('.gstatic.com');

/** The store's own title, without control characters and cut to a safe length; null when empty. */
export function cleanTitle(raw: string | null): string | null {
  const text = (raw ?? '')
    // eslint-disable-next-line no-control-regex -- stripping control characters from untrusted text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length <= TITLE_MAX ? text : `${text.slice(0, TITLE_MAX - 1)}…`;
}

/** The search query for one garment: its search phrase and the department, nothing else. */
export function queryFor(slot: LookSlot, department: string | null | undefined): string {
  return [slot.searchPhrase, department].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** The three searches for one garment and the one store whose listings each of them contributes. */
export function searchesFor(query: string): Array<{ query: string; store: PriceRangeStore }> {
  return [
    { query, store: 'amazon' },
    { query: `${query} flipkart`, store: 'flipkart' },
    { query: `${query} meesho`, store: 'meesho' },
  ];
}

/** One store's listing from a raw reply, or null when it is another store or has no usable price or title. */
export function toListing(raw: ShoppingListing, store: PriceRangeStore): CachedListing | null {
  if (storeOf(raw.source) !== store) return null;
  const price = parseInr(raw.price);
  const title = cleanTitle(raw.title);
  if (price === null || title === null) return null;
  return {
    store,
    title,
    price,
    link: safeUrl(raw.link, googleShopping),
    imageUrl: safeUrl(raw.imageUrl, googleThumbnail),
  };
}

const cacheKeyOf = (provider: string, store: PriceRangeStore, query: string) =>
  createHash('sha256').update(`price-search|${CACHE_VERSION}|${provider}|${store}|${query}`).digest('hex');

const round = (n: number) => Math.round(n * 100) / 100;

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

export class PriceRangeService {
  constructor(
    private readonly models: Models,
    private readonly provider: ShoppingSearchProvider | null,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Whether price ranges can be checked (a provider is configured). */
  get enabled(): boolean {
    return this.provider !== null;
  }

  /** `GET /v1/outfits/:id/price-range`: the price range of one of the user's own looks. */
  async range(userId: Types.ObjectId, outfitId: Types.ObjectId): Promise<LookPriceRange> {
    const searched = await this.search(userId, outfitId);
    const slots: SlotPriceRange[] = searched.map(({ slot, listings }) => {
      const prices = listings.map((l) => l.price);
      return {
        slotId: slot.slotId,
        min: prices.length ? round(Math.min(...prices)) : null,
        max: prices.length ? round(Math.max(...prices)) : null,
        listings: prices.length,
        stores: PRICE_RANGE_STORE_IDS.filter((s) => listings.some((l) => l.store === s)),
      };
    });
    const priced = slots.filter((s) => s.listings > 0);
    return {
      currency: 'INR',
      priceBasis: 'search_results',
      min: priced.length ? round(priced.reduce((sum, s) => sum + s.min!, 0)) : null,
      max: priced.length ? round(priced.reduce((sum, s) => sum + s.max!, 0)) : null,
      pricedSlots: priced.length,
      totalSlots: slots.length,
      slots,
      stores: PRICE_RANGE_STORE_IDS.filter((s) => slots.some((slot) => slot.stores.includes(s))),
      checkedAt: oldest(searched).toISOString(),
      label: PRICE_RANGE_LABEL,
    };
  }

  /**
   * `GET /v1/outfits/:id/products` (#120): for each garment, the cheapest `PRODUCTS_PER_STORE` listings per
   * store, cheapest first, and the count, lowest, median and highest price per store found.
   */
  async products(userId: Types.ObjectId, outfitId: Types.ObjectId): Promise<LookProductMatches> {
    const searched = await this.search(userId, outfitId, { alternatives: true });
    const slots: SlotProducts[] = searched.map(({ slot, listings, alternatives }) => {
      const stats: StorePriceStats[] = PRICE_RANGE_STORE_IDS.flatMap((store) => {
        const prices = listings
          .filter((l) => l.store === store)
          .map((l) => l.price)
          .sort((a, b) => a - b);
        if (prices.length === 0) return [];
        return [{ store, listings: prices.length, min: prices[0]!, median: median(prices), max: prices.at(-1)! }];
      });
      // Matches (#133): best match first (most of the garment's attributes in the title), then cheapest.
      const byMatch = (a: MatchedListing, b: MatchedListing) =>
        b.matched.length - a.matched.length || a.price - b.price;
      const matched = listings.map((l) => ({ ...l, matched: matchedAttributes(l.title, slot.lookSpec) }));
      const matches = PRICE_RANGE_STORE_IDS.flatMap((store) =>
        matched
          .filter((l) => l.store === store)
          .sort(byMatch)
          .slice(0, PRODUCTS_PER_STORE),
      ).sort(byMatch);
      // Other styles of the same garment (#133): never an item already listed as a match.
      const seen = new Set(listings.map(listingKey));
      const others = PRICE_RANGE_STORE_IDS.flatMap((store) =>
        dedupe(alternatives.filter((l) => l.store === store && !seen.has(listingKey(l))))
          .sort((a, b) => a.price - b.price)
          .slice(0, ALTERNATIVES_PER_STORE),
      ).sort((a, b) => a.price - b.price);
      const cleanSlotId = slot.slotId === 'one_piece' ? 'one-piece' : slot.slotId;
      return { slotId: cleanSlotId, listings: matches, alternatives: others, stats };
    });
    return {
      currency: 'INR',
      priceBasis: 'search_results',
      slots,
      checkedAt: oldest(searched).toISOString(),
      label: PRODUCT_MATCHES_LABEL,
    };
  }

  /** `GET /v1/outfits/:id/picks` (#120): the products the user picked for the look's garments. */
  async picks(userId: Types.ObjectId, outfitId: Types.ObjectId): Promise<LookPick[]> {
    const look = await this.models.Outfit.findOne(this.owned(userId, outfitId), { shopPicks: 1 }).lean();
    if (!look) throw new AppError('NOT_FOUND');
    return (look.shopPicks ?? []) as LookPick[];
  }

  /**
   * `PUT /v1/outfits/:id/picks` (#120): picks a product for one garment, replacing an earlier pick. Only a
   * listing the search returned for that garment can be picked, so a pick is never a made-up product.
   */
  async pick(userId: Types.ObjectId, outfitId: Types.ObjectId, request: PickProductRequest): Promise<LookPick[]> {
    const { slots } = await this.products(userId, outfitId);
    const slot = slots.find((s) => s.slotId === request.slotId);
    if (!slot) throw new AppError('INVALID_REQUEST', 'That part of the look can’t be shopped.');
    const { listing } = request;
    // A match or another style (#133), as the search returned it.
    const found = [...slot.listings, ...slot.alternatives].find(
      (l) =>
        l.store === listing.store && l.title === listing.title && l.price === listing.price && l.link === listing.link,
    );
    if (!found) throw new AppError('NOT_FOUND', 'That item is no longer in the search results. Please pick another.');
    const pick: LookPick = {
      store: found.store,
      title: found.title,
      price: found.price,
      link: found.link,
      imageUrl: found.imageUrl,
      slotId: slot.slotId,
      pickedAt: this.now().toISOString(),
    };
    // One pick per garment: drop the slot's earlier pick, then add this one.
    await this.models.Outfit.updateOne(this.owned(userId, outfitId), { $pull: { shopPicks: { slotId: slot.slotId } } });
    const doc = await this.models.Outfit.findOneAndUpdate(
      this.owned(userId, outfitId),
      { $push: { shopPicks: pick } },
      { returnDocument: 'after', projection: { shopPicks: 1 } },
    ).lean();
    if (!doc) throw new AppError('NOT_FOUND');
    return (doc.shopPicks ?? []) as LookPick[];
  }

  /** `DELETE /v1/outfits/:id/picks/:slotId` (#120): removes the pick for one garment (harmless if none). */
  async unpick(userId: Types.ObjectId, outfitId: Types.ObjectId, slotId: string): Promise<LookPick[]> {
    const doc = await this.models.Outfit.findOneAndUpdate(
      this.owned(userId, outfitId),
      { $pull: { shopPicks: { slotId } } },
      { returnDocument: 'after', projection: { shopPicks: 1 } },
    ).lean();
    if (!doc) throw new AppError('NOT_FOUND');
    return (doc.shopPicks ?? []) as LookPick[];
  }

  /** The user's own look if it still exists: saved, or a suggestion not past its expiry. */
  private owned(userId: Types.ObjectId, outfitId: Types.ObjectId) {
    return { _id: outfitId, userId, $or: [{ expiresAt: null }, { expiresAt: { $gt: this.now() } }] };
  }

  /**
   * The look's garments, each with its Amazon, Flipkart and Meesho listings from the three searches, and with
   * `alternatives`, also from three broader searches of the garment's category and the department (#133).
   */
  private async search(
    userId: Types.ObjectId,
    outfitId: Types.ObjectId,
    options: { alternatives?: boolean } = {},
  ): Promise<Searched[]> {
    const look = await this.models.Outfit.findOne(this.owned(userId, outfitId)).lean<StoredLook>();
    if (!look) throw new AppError('NOT_FOUND');
    if (!this.provider) throw new AppError('PROVIDER_NOT_CONFIGURED', 'Price ranges are not available yet.');

    const garments = look.slots.filter((s) => GARMENT_SLOTS.has(s.slot));
    const slotsToPrice = garments.length > 0 ? garments : look.slots;
    const department = look.inputsUsed?.department ?? null;
    return Promise.all(
      slotsToPrice.map(async (slot) => {
        const run = (query: string) =>
          Promise.all(searchesFor(query).map((search) => this.listings(search.query, search.store)));
        const [results, broad] = await Promise.all([
          run(queryFor(slot, department)),
          options.alternatives ? run(categoryQuery(slot.lookSpec, department)) : Promise.resolve([]),
        ]);
        const all = [...results, ...broad];
        return {
          slot,
          listings: results.flatMap((r) => r.listings),
          alternatives: broad.flatMap((r) => r.listings),
          checkedAt: new Date(Math.min(...all.map((r) => r.checkedAt.getTime()))),
        };
      }),
    );
  }

  /** One store's listings for one query: cached for a day, else searched now. */
  private async listings(
    query: string,
    store: PriceRangeStore,
  ): Promise<{ listings: CachedListing[]; checkedAt: Date }> {
    const provider = this.provider!;
    const cacheKey = cacheKeyOf(provider.name, store, query);
    const cached = await this.models.PriceSearchCache.findOne({ cacheKey, expiresAt: { $gt: this.now() } }).lean();
    if (cached) return { listings: cached.listings as CachedListing[], checkedAt: cached.checkedAt };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let raw;
    try {
      raw = await provider.search(query, controller.signal);
    } catch (err) {
      const cause = err instanceof ShoppingProviderError ? err.cause : 'provider_error';
      this.logger.warn({ event: 'price_search_failed', cause, provider: provider.name });
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE', UNAVAILABLE);
    } finally {
      clearTimeout(timer);
    }

    const listings = raw.flatMap((l) => toListing(l, store) ?? []);
    const checkedAt = this.now();
    await this.models.PriceSearchCache.updateOne(
      { cacheKey },
      {
        $set: {
          provider: provider.name,
          listings,
          checkedAt,
          expiresAt: new Date(checkedAt.getTime() + PRICE_SEARCH_TTL_MS),
        },
      },
      { upsert: true },
    );
    return { listings, checkedAt };
  }
}

/**
 * One listing's identity across searches: its store and title. Not the Google link, which carries the
 * search query, so the same item has a different link in each search.
 */
const listingKey = (l: CachedListing) => `${l.store}|${l.title.toLowerCase().replace(/\s+/g, ' ').trim()}`;

/** The first of each listing that appears more than once. */
function dedupe(list: CachedListing[]): CachedListing[] {
  const seen = new Set<string>();
  return list.filter((l) => !seen.has(listingKey(l)) && seen.add(listingKey(l)));
}

const oldest = (searched: readonly Searched[]) => new Date(Math.min(...searched.map((s) => s.checkedAt.getTime())));
