import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_REASONS,
  USER_ENTERED_LABELS,
  WEAR_TYPES,
  createShortlistItemRequestSchema,
  lookSchema,
  outfitDetailSchema,
  outfitFeedbackRequestSchema,
  outfitListQuerySchema,
  paletteListQuerySchema,
  paletteListResponseSchema,
  recommendationRequestSchema,
  recommendationResponseSchema,
  shopEntryPointSchema,
  shortlistListQuerySchema,
  shortlistListResponseSchema,
  userPriceSummarySchema,
  userShortlistItemSchema,
} from '../src';

type Schema = { safeParse: (value: unknown) => { success: boolean } };
const ok = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(true);
const bad = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(false);

const ID = '64b7f0c2a1b2c3d4e5f60718';
const ID2 = '64b7f0c2a1b2c3d4e5f60719';
const swatch = { colorId: 'navy', name: 'Navy', hex: '#1F2A44' };
const slot = (slotId: string) => ({
  slotId,
  slot: 'top',
  lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy', fabric: 'cotton' },
  swatches: [swatch],
  searchPhrase: 'navy cotton kurta',
  sizeNote: 'Your saved size: M',
  alternatives: [],
});
const look = {
  id: ID,
  status: 'suggested',
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: [slot('top'), { ...slot('accessory-1'), slot: 'accessory' }],
  explanation: 'A V-neck creates a longer line.',
  explanationRefs: { ruleIds: ['STY-001'], attributes: [{ attribute: 'neckline', value: 'v_neck' }] },
  combinationSignature: 'abc123',
  aiModel: null,
};

describe('recommendation request (FR-LOOK-01, D-96)', () => {
  it('needs only an occasion and defaults the palette mode', () => {
    expect(recommendationRequestSchema.parse({ occasion: 'work' })).toEqual({
      occasion: 'work',
      paletteMode: 'suggested',
    });
  });

  it('accepts every approved wear type, alone or together', () => {
    ok(recommendationRequestSchema, {
      occasion: 'festive',
      style: 'fusion',
      wearType: ['indian'],
      paletteMode: 'explore',
    });
    ok(recommendationRequestSchema, { occasion: 'party', wearType: WEAR_TYPES.map((w) => w.id) });
  });

  it('rejects unknown, duplicate or empty wear types', () => {
    bad(recommendationRequestSchema, { occasion: 'work', wearType: ['kids'] });
    bad(recommendationRequestSchema, { occasion: 'work', wearType: 'indian' });
    bad(recommendationRequestSchema, { occasion: 'work', wearType: ['indian', 'indian'] });
    bad(recommendationRequestSchema, { occasion: 'work', wearType: [] });
  });

  it('rejects a missing occasion and fields outside Stage 1', () => {
    bad(recommendationRequestSchema, {});
    bad(recommendationRequestSchema, { occasion: 'brunch' });
    bad(recommendationRequestSchema, { occasion: 'work', budget: 3000 });
    bad(recommendationRequestSchema, { occasion: 'work', category: 'kurta' });
    bad(recommendationRequestSchema, { occasion: 'work', paletteMode: 'random' });
  });
});

describe('look and recommendation response', () => {
  it('accepts a valid look', () => ok(lookSchema, look));

  it('rejects duplicate slot IDs, bad IDs and product-layer fields', () => {
    bad(lookSchema, { ...look, slots: [slot('top'), slot('top')] });
    bad(lookSchema, { ...look, slots: [] });
    bad(lookSchema, { ...look, templateId: 'T-1' });
    bad(lookSchema, { ...look, slots: [slot('Top Slot')] });
    bad(lookSchema, { ...look, slots: [{ ...slot('top'), productMatch: { productId: 'x' } }] });
    bad(lookSchema, { ...look, priceSummary: {} });
  });

  it('accepts up to 5 suggested looks, or none with a limiting constraint', () => {
    ok(recommendationResponseSchema, {
      recommendationId: ID,
      looks: [look],
      defaultsApplied: ['style'],
      conflicts: [],
    });
    ok(recommendationResponseSchema, {
      recommendationId: ID,
      looks: [],
      defaultsApplied: [],
      conflicts: [{ field: 'colors', value: 'navy' }],
      limitedBy: { constraint: 'dislikedColors', suggestion: 'Allow one more colour' },
    });
  });

  it('rejects more than 5 looks and saved looks in a new recommendation', () => {
    bad(recommendationResponseSchema, {
      recommendationId: ID,
      looks: Array.from({ length: 6 }, () => look),
      defaultsApplied: [],
      conflicts: [],
    });
    bad(recommendationResponseSchema, {
      recommendationId: ID,
      looks: [{ ...look, status: 'saved' }],
      defaultsApplied: [],
      conflicts: [],
    });
  });
});

describe('saved looks', () => {
  it('lists saved looks by default with D-18 pagination', () => {
    expect(outfitListQuerySchema.parse({})).toEqual({ page: 1, limit: 20, status: 'saved' });
    expect(outfitListQuerySchema.parse({ page: '2', limit: '50', status: 'suggested' })).toEqual({
      page: 2,
      limit: 50,
      status: 'suggested',
    });
    bad(outfitListQuerySchema, { limit: '51' });
    bad(outfitListQuerySchema, { page: '0' });
    bad(outfitListQuerySchema, { status: 'deleted' });
  });

  // The request and inputs snapshot the look was generated from, for regenerate (#49).
  const stored = {
    request: { occasion: 'work', paletteMode: 'suggested' },
    inputsUsed: {
      department: 'women',
      departmentFiltered: true,
      likedColors: ['navy'],
      dislikedColors: [],
      contrastPreference: null,
      silhouettePreferences: [],
      fitPreferences: { tops: 'slim', bottoms: null, ethnicTops: null, ethnicSets: null },
      coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
      fabricPreferences: { liked: [], avoided: [] },
      preferredStyles: [],
      sizesSaved: ['tops'],
      signalsUsed: false,
    },
  };

  it('a detail carries the attached items, the request and the inputs used', () => {
    ok(outfitDetailSchema, { ...look, ...stored, status: 'saved', userItems: [] });
    bad(outfitDetailSchema, { ...look, ...stored, status: 'saved' });
    bad(outfitDetailSchema, { ...look, status: 'saved', userItems: [] });
  });

  it('the inputs used name sizes by group only and signals only as used or not (#49)', () => {
    const detail = { ...look, ...stored, userItems: [] };
    bad(outfitDetailSchema, { ...detail, inputsUsed: { ...stored.inputsUsed, sizesSaved: ['dresses'] } });
    bad(outfitDetailSchema, { ...detail, inputsUsed: { ...stored.inputsUsed, undertone: 'warm' } });
    bad(outfitDetailSchema, { ...detail, inputsUsed: { ...stored.inputsUsed, signalsUsed: undefined } });
  });

  it('the shop entry point is { outfitId, slotId }', () => {
    ok(shopEntryPointSchema, { outfitId: ID, slotId: 'top' });
    bad(shopEntryPointSchema, { outfitId: ID });
    bad(shopEntryPointSchema, { outfitId: 'abc', slotId: 'top' });
  });
});

describe('feedback (FR-OUT-04)', () => {
  it('accepts both values and a fixed reason with "not for me"', () => {
    ok(outfitFeedbackRequestSchema, { value: 'love_it' });
    for (const reason of FEEDBACK_REASONS) ok(outfitFeedbackRequestSchema, { value: 'not_for_me', reason: reason.id });
  });

  it('rejects free text, unknown reasons and a reason with "love it"', () => {
    bad(outfitFeedbackRequestSchema, { value: 'not_for_me', reason: 'I just hate it' });
    bad(outfitFeedbackRequestSchema, { value: 'love_it', reason: 'too_formal' });
    bad(outfitFeedbackRequestSchema, { value: 'not_for_me', comment: 'text' });
    bad(outfitFeedbackRequestSchema, { value: 'meh' });
  });

  it('keeps every recorded reason ID (IDs are never renamed or removed)', () => {
    expect(FEEDBACK_REASONS.map((r) => r.id)).toEqual(
      expect.arrayContaining([
        'not_my_style',
        'colours_not_for_me',
        'too_formal',
        'too_casual',
        'not_comfortable',
        'wrong_occasion',
      ]),
    );
  });
});

describe('palettes (API.md §3.4)', () => {
  const palette = {
    id: 'PAL-001',
    name: 'Soft neutrals',
    neutrals: [swatch],
    accents: [],
    combinations: [{ colors: [swatch, { colorId: 'ivory', name: 'Ivory', hex: '#FFFFF0' }], contrastLevel: 'medium' }],
    rationale: 'Navy and ivory give medium contrast.',
    limitations: 'Less vivid for festive occasions.',
    suggestedBecause: [],
  };

  it('accepts a valid palette list and defaults the view', () => {
    ok(paletteListResponseSchema, { palettes: [palette] });
    expect(paletteListQuerySchema.parse({})).toEqual({ view: 'suggested' });
  });

  it('rejects a bad hex, single-colour combinations and unknown views', () => {
    bad(paletteListResponseSchema, { palettes: [{ ...palette, neutrals: [{ ...swatch, hex: 'navy' }] }] });
    bad(paletteListResponseSchema, {
      palettes: [{ ...palette, combinations: [{ colors: [swatch], contrastLevel: 'low' }] }],
    });
    bad(paletteListQuerySchema, { view: 'mine' });
  });
});

describe('shortlist (FR-LIST-07, D-80)', () => {
  const item = { name: 'Navy kurta', priceEntered: 1299.5 };

  it('accepts unattached and attached items', () => {
    ok(createShortlistItemRequestSchema, item);
    ok(createShortlistItemRequestSchema, {
      ...item,
      url: 'https://shop.example/k',
      note: 'Cotton',
      outfitId: ID,
      slotId: 'top',
    });
  });

  it('rejects invalid input', () => {
    bad(createShortlistItemRequestSchema, { ...item, outfitId: ID });
    bad(createShortlistItemRequestSchema, { ...item, slotId: 'top' });
    bad(createShortlistItemRequestSchema, { ...item, url: 'http://shop.example/k' });
    bad(createShortlistItemRequestSchema, { ...item, url: 'https://e.com/' + 'a'.repeat(2048) });
    bad(createShortlistItemRequestSchema, { ...item, name: '' });
    bad(createShortlistItemRequestSchema, { ...item, name: 'a'.repeat(121) });
    bad(createShortlistItemRequestSchema, { ...item, note: 'a'.repeat(301) });
    bad(createShortlistItemRequestSchema, { ...item, priceEntered: 0 });
    bad(createShortlistItemRequestSchema, { ...item, priceEntered: 1_000_001 });
    bad(createShortlistItemRequestSchema, { ...item, retailer: 'Shop' });
  });

  it('filters the list by look', () => {
    expect(shortlistListQuerySchema.parse({ outfitId: ID })).toEqual({ page: 1, limit: 20, outfitId: ID });
    bad(shortlistListQuerySchema, { outfitId: 'x' });
  });

  const stored = {
    id: ID2,
    ...item,
    currency: 'INR',
    priceBasis: 'user_entered',
    verifiedByStyleMe: false,
    url: null,
    note: null,
    outfitId: ID,
    slotId: 'top',
    createdAt: '2026-10-16T10:00:00.000Z',
  };

  it('returned items are always user-entered and unverified', () => {
    ok(userShortlistItemSchema, stored);
    ok(userShortlistItemSchema, { ...stored, outfitId: null, slotId: null });
    bad(userShortlistItemSchema, { ...stored, verifiedByStyleMe: true });
    bad(userShortlistItemSchema, { ...stored, priceBasis: 'verified' });
    bad(userShortlistItemSchema, { ...stored, slotId: null });
    bad(userShortlistItemSchema, { ...stored, imageUrl: 'https://x.example/i.jpg' });
  });

  it('a list page carries items and counts only, never a list-level total', () => {
    ok(shortlistListResponseSchema, { items: [stored], page: 1, limit: 20, total: 1 });
    ok(shortlistListResponseSchema, { items: [], page: 2, limit: 20, total: 0 });
    bad(shortlistListResponseSchema, { items: [stored], page: 1, limit: 20, total: 1, itemsTotal: 1299.5 });
    bad(shortlistListResponseSchema, { items: [], page: 0, limit: 20, total: 0 });
  });
});

describe('Stage 1 price summary (FR-BUD-03, FR-BUD-07)', () => {
  const summary = {
    priceBasis: 'user_entered',
    itemsTotal: 3000,
    pricedSlots: 2,
    totalSlots: 3,
    complete: false,
    budget: 4000,
    budgetRemaining: 1000,
    status: 'within_budget',
    label: USER_ENTERED_LABELS.total,
  };

  it('accepts consistent summaries, including a total equal to the budget and no budget', () => {
    ok(userPriceSummarySchema, summary);
    ok(userPriceSummarySchema, { ...summary, itemsTotal: 4000, budgetRemaining: 0 });
    ok(userPriceSummarySchema, { ...summary, itemsTotal: 5000, budgetRemaining: -1000, status: 'over_budget' });
    ok(userPriceSummarySchema, { ...summary, budget: null, budgetRemaining: null, status: 'no_budget' });
    ok(userPriceSummarySchema, { ...summary, pricedSlots: 3, complete: true });
  });

  it('rejects inconsistent summaries and other price bases', () => {
    bad(userPriceSummarySchema, { ...summary, status: 'over_budget' });
    bad(userPriceSummarySchema, { ...summary, budgetRemaining: 500 });
    bad(userPriceSummarySchema, { ...summary, complete: true });
    bad(userPriceSummarySchema, { ...summary, pricedSlots: 4 });
    bad(userPriceSummarySchema, { ...summary, budget: null, budgetRemaining: null });
    bad(userPriceSummarySchema, { ...summary, priceBasis: 'verified' });
    bad(userPriceSummarySchema, { ...summary, label: 'Total' });
  });
});
