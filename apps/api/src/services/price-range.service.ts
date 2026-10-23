import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import {
  PRICE_RANGE_LABEL,
  PRICE_RANGE_STORE_IDS,
  PRODUCTS_PER_STORE,
  PRODUCT_MATCHES_LABEL,
  type LookInputs,
  type LookPriceRange,
  type LookProductMatches,
  type LookSlot,
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
    const searched = await this.search(userId, outfitId);
    const slots: SlotProducts[] = searched.map(({ slot, listings }) => {
      const byStore = PRICE_RANGE_STORE_IDS.map((store) =>
        listings.filter((l) => l.store === store).sort((a, b) => a.price - b.price),
      );
      const stats: StorePriceStats[] = byStore.flatMap((list) => {
        if (list.length === 0) return [];
        const prices = list.map((l) => l.price);
        return [
          {
            store: list[0]!.store,
            listings: list.length,
            min: prices[0]!,
            median: median(prices),
            max: prices[prices.length - 1]!,
          },
        ];
      });
      return {
        slotId: slot.slotId,
        listings: byStore.flatMap((list) => list.slice(0, PRODUCTS_PER_STORE)).sort((a, b) => a.price - b.price),
        stats,
      };
    });
    return {
      currency: 'INR',
      priceBasis: 'search_results',
      slots,
      checkedAt: oldest(searched).toISOString(),
      label: PRODUCT_MATCHES_LABEL,
    };
  }

  /** The look's garments, each with its Amazon, Flipkart and Meesho listings from the three searches. */
  private async search(userId: Types.ObjectId, outfitId: Types.ObjectId): Promise<Searched[]> {
    const look = await this.models.Outfit.findOne({
      _id: outfitId,
      userId,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: this.now() } }],
    }).lean<StoredLook>();
    if (!look) throw new AppError('NOT_FOUND');
    if (!this.provider) throw new AppError('PROVIDER_NOT_CONFIGURED', 'Price ranges are not available yet.');

    const garments = look.slots.filter((s) => GARMENT_SLOTS.has(s.slot));
    const slotsToPrice = garments.length > 0 ? garments : look.slots;
    const department = look.inputsUsed?.department ?? null;
    return Promise.all(
      slotsToPrice.map(async (slot) => {
        const results = await Promise.all(
          searchesFor(queryFor(slot, department)).map(({ query, store }) => this.listings(query, store)),
        );
        return {
          slot,
          listings: results.flatMap((r) => r.listings),
          checkedAt: new Date(Math.min(...results.map((r) => r.checkedAt.getTime()))),
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

const oldest = (searched: readonly Searched[]) => new Date(Math.min(...searched.map((s) => s.checkedAt.getTime())));
