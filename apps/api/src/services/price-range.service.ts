import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type { Logger } from 'pino';
import {
  PRICE_RANGE_LABEL,
  PRICE_RANGE_STORE_IDS,
  type LookInputs,
  type LookPriceRange,
  type LookSlot,
  type PriceRangeStore,
  type SlotPriceRange,
} from '@styleme/contracts';
import { ShoppingProviderError, type ShoppingSearchProvider } from '../integrations/shopping/serper-client';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';

// Price ranges on Shop My Look tabs (#118). For each garment of one of the user's own looks, the service
// searches store listings with the garment's search phrase and the department only (never sizes,
// measurements, photos, appearance or anything else about the user), keeps Amazon, Flipkart and Meesho
// listings, and reports the lowest and highest price found. Only prices the provider returned are used:
// a garment without listings has no range, never a guessed one. Results are cached per query for a day
// in `priceSearchCache` (system data: the key is the query, no user ID). Queries, listings and prices are
// never logged.

/** How long one query's listings are reused. */
export const PRICE_SEARCH_TTL_MS = 24 * 60 * 60 * 1000;

/** Footwear and accessories are hidden in looks (#111), so only garments are priced. */
const GARMENT_SLOTS = new Set(['layer', 'one_piece', 'top', 'bottom']);

/** Listing prices outside this band are parsing noise or not a garment, and are left out. */
const MIN_PRICE = 50;
const MAX_PRICE = 500_000;

const UNAVAILABLE = 'We couldn’t check prices just now. Please try again later.';

interface StoredLook {
  _id: Types.ObjectId;
  slots: LookSlot[];
  inputsUsed?: LookInputs;
}

interface CachedListing {
  store: PriceRangeStore;
  price: number;
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

/** The search query for one garment: its search phrase and the department, nothing else. */
export function queryFor(slot: LookSlot, department: string | null | undefined): string {
  return [slot.searchPhrase, department].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

const cacheKeyOf = (provider: string, query: string) =>
  createHash('sha256').update(`price-search|${provider}|${query}`).digest('hex');

const round = (n: number) => Math.round(n * 100) / 100;

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
    const searched = await Promise.all(slotsToPrice.map((slot) => this.listings(queryFor(slot, department))));

    const slots: SlotPriceRange[] = slotsToPrice.map((slot, i) => {
      const prices = searched[i]!.listings.map((l) => l.price);
      return {
        slotId: slot.slotId,
        min: prices.length ? round(Math.min(...prices)) : null,
        max: prices.length ? round(Math.max(...prices)) : null,
        listings: prices.length,
        stores: PRICE_RANGE_STORE_IDS.filter((s) => searched[i]!.listings.some((l) => l.store === s)),
      };
    });
    const priced = slots.filter((s) => s.listings > 0);
    const checkedAt = new Date(Math.min(...searched.map((s) => s.checkedAt.getTime())));
    return {
      currency: 'INR',
      priceBasis: 'search_results',
      min: priced.length ? round(priced.reduce((sum, s) => sum + s.min!, 0)) : null,
      max: priced.length ? round(priced.reduce((sum, s) => sum + s.max!, 0)) : null,
      pricedSlots: priced.length,
      totalSlots: slots.length,
      slots,
      stores: PRICE_RANGE_STORE_IDS.filter((s) => slots.some((slot) => slot.stores.includes(s))),
      checkedAt: checkedAt.toISOString(),
      label: PRICE_RANGE_LABEL,
    };
  }

  /** The Amazon, Flipkart and Meesho listings for one query: cached for a day, else searched now. */
  private async listings(query: string): Promise<{ listings: CachedListing[]; checkedAt: Date }> {
    const provider = this.provider!;
    const cacheKey = cacheKeyOf(provider.name, query);
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

    const listings = raw.flatMap((l): CachedListing[] => {
      const store = storeOf(l.source);
      const price = store ? parseInr(l.price) : null;
      return store && price !== null ? [{ store, price }] : [];
    });
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
