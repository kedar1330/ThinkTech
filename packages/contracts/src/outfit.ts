import { z } from 'zod';
import {
  categorySchema,
  colorFamilySchema,
  colorIdSchema,
  contrastPreferenceSchema,
  departmentSchema,
  fabricSchema,
  fitSchema,
  garmentLengthSchema,
  heightBandSchema,
  necklineDepthSchema,
  necklineSchema,
  occasionSchema,
  patternSchema,
  silhouetteSchema,
  sleeveLengthSchema,
  slotTypeSchema,
  styleSchema,
  wearTypeSchema,
} from './style-vocabulary';
import { objectIdSchema, paginationQuerySchema, paletteIdSchema, slotIdSchema, templateIdSchema } from './common';
import { garmentTypeIdSchema } from './design-features';
import { userPriceSummarySchema, userShortlistItemSchema } from './product';
import { FIT_GROUPS, SIZED_GROUPS_STAGE_1 } from './profile';

// Recommendations and looks (FR-LOOK, FR-OUT, API.md §3.5, DATABASE.md §3.4).
// Stage 1 shapes only: no price, retailer, availability or product match appears in a generated look
// (D-77 = B). Product-layer fields (`budget`, `productMatch`, verified price summaries) are added only
// when that layer is approved, so the strict schemas below reject them today.

const uniqueList = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((list) => new Set(list).size === list.length, { message: 'Duplicate values' });

// --- Request -------------------------------------------------------------------------------------------

export const PALETTE_MODES = ['suggested', 'explore'] as const;
export const paletteModeSchema = z.enum(PALETTE_MODES);
export type PaletteMode = z.infer<typeof paletteModeSchema>;

/**
 * `POST /v1/recommendations` (FR-LOOK-01). Only `occasion` is required. `wearType`, when sent, is a
 * hard filter for this request (D-96); without it, the profile's preferred wear types only rank results.
 */
/**
 * Looks built around a garment the user designed in Outfit Categories (D-132). IDs only: the API reads the
 * chosen features from the user's own saved selection, never from the request.
 */
export const designRequestSchema = z
  .object({ garmentType: garmentTypeIdSchema, outfitCategory: wearTypeSchema })
  .strict();
export type DesignRequest = z.infer<typeof designRequestSchema>;

export const recommendationRequestSchema = z
  .object({
    occasion: occasionSchema,
    style: styleSchema.optional(),
    wearType: uniqueList(wearTypeSchema, 3).min(1).optional(),
    paletteMode: paletteModeSchema.default('suggested'),
    design: designRequestSchema.optional(),
    customColors: z.array(z.string().trim().min(1)).max(10).optional(),
  })
  .strict();
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;

// --- Look and slots ------------------------------------------------------------------------------------

/** What to look for in a slot (DATABASE.md §3.4). */
export const lookSpecSchema = z
  .object({
    category: categorySchema,
    colorFamily: colorFamilySchema,
    colorId: colorIdSchema,
    fabric: fabricSchema.optional(),
    fit: fitSchema.optional(),
    silhouette: silhouetteSchema.optional(),
    neckline: necklineSchema.optional(),
    sleeve: sleeveLengthSchema.optional(),
    length: garmentLengthSchema.optional(),
    pattern: patternSchema.optional(),
  })
  .strict();
export type LookSpec = z.infer<typeof lookSpecSchema>;

export const swatchSchema = z
  .object({
    colorId: colorIdSchema,
    name: z.string().trim().min(1),
    hex: z.string().regex(/^#[0-9A-F]{6}$/),
  })
  .strict();
export type Swatch = z.infer<typeof swatchSchema>;

/** A labelled style illustration, shown only where a cleared asset exists (FR-DATA-06). */
export const illustrationSchema = z
  .object({
    url: z.string().min(1),
    licenceLabel: z.string().trim().min(1),
    /** How the illustration was created – 'ai' or 'manual'. */
    generatedBy: z.enum(['ai', 'manual']).optional(),
    /** Founder‑approved flag – defaults to false so un‑cleared assets stay hidden. */
    approved: z.boolean().default(false),
  })
  .strict();

/** A meaningfully different variation of one slot (FR-LOOK-14). */
export const slotAlternativeSchema = z
  .object({
    lookSpec: lookSpecSchema,
    swatches: z.array(swatchSchema).min(1),
    searchPhrase: z.string().trim().min(1),
  })
  .strict();
export type SlotAlternative = z.infer<typeof slotAlternativeSchema>;

export const lookSlotSchema = z
  .object({
    slotId: slotIdSchema,
    slot: slotTypeSchema,
    lookSpec: lookSpecSchema,
    swatches: z.array(swatchSchema).min(1),
    illustration: illustrationSchema.optional(),
    /** Generic phrase the user can search for anywhere (FR-LOOK-15). */
    searchPhrase: z.string().trim().min(1),
    /** E.g. "Your saved size: M", or a prompt to add one (FR-SIZE-04). */
    sizeNote: z.string().trim().min(1),
    alternatives: z.array(slotAlternativeSchema),
  })
  .strict();
export type LookSlot = z.infer<typeof lookSlotSchema>;

/** The rules and matched attributes the explanation was built from (FR-LOOK-12). */
export const explanationRefsSchema = z
  .object({
    ruleIds: z.array(z.string().regex(/^(STY|FAB)-\d{3,}$/)),
    attributes: z.array(z.object({ attribute: z.string().min(1), value: z.string().min(1) }).strict()),
  })
  .strict();

export const OUTFIT_STATUSES = ['suggested', 'saved'] as const;
export const outfitStatusSchema = z.enum(OUTFIT_STATUSES);
export type OutfitStatus = z.infer<typeof outfitStatusSchema>;

/**
 * The feature a look was created in, stored on the look (#115). Every look `POST /v1/recommendations`
 * makes today comes from Discover My Style; Shop My Look shows tabs for those only.
 */
export const OUTFIT_SOURCES = ['discover_my_style'] as const;
export const outfitSourceSchema = z.enum(OUTFIT_SOURCES);
export type OutfitSource = z.infer<typeof outfitSourceSchema>;

// --- Feedback (FR-OUT-04): no free text is collected ------------------------------------------------

export const FEEDBACK_VALUES = ['love_it', 'not_for_me'] as const;
export const feedbackValueSchema = z.enum(FEEDBACK_VALUES);
export type FeedbackValue = z.infer<typeof feedbackValueSchema>;

// Reasons describe the look, never the user's body. IDs are stable; add new ones, never rename.
export const FEEDBACK_REASONS = [
  { id: 'not_my_style', label: 'Not my style' },
  { id: 'colours_not_for_me', label: 'Colours not for me' },
  { id: 'too_formal', label: 'Too formal' },
  { id: 'too_casual', label: 'Too casual' },
  { id: 'not_comfortable', label: 'Doesn’t look comfortable' },
  { id: 'wrong_occasion', label: 'Not right for the occasion' },
] as const;
export const FEEDBACK_REASON_IDS = FEEDBACK_REASONS.map((r) => r.id) as [
  (typeof FEEDBACK_REASONS)[number]['id'],
  ...(typeof FEEDBACK_REASONS)[number]['id'][],
];
export const feedbackReasonSchema = z.enum(FEEDBACK_REASON_IDS);
export type FeedbackReasonId = z.infer<typeof feedbackReasonSchema>;

export const lookFeedbackSchema = z
  .object({
    value: feedbackValueSchema,
    reason: feedbackReasonSchema.optional(),
  })
  .strict()
  .refine((f) => f.reason === undefined || f.value === 'not_for_me', {
    message: 'A reason can only be given with "not for me"',
    path: ['reason'],
  });
export type LookFeedback = z.infer<typeof lookFeedbackSchema>;

/** The look attributes a design is compared on. */
export const DESIGN_MATCH_ATTRIBUTES = ['neckline', 'sleeve', 'fit', 'silhouette', 'length'] as const;
export const designMatchAttributeSchema = z.enum(DESIGN_MATCH_ATTRIBUTES);
export type DesignMatchAttribute = z.infer<typeof designMatchAttributeSchema>;

/**
 * How a look compares with the design it was requested for: `full` (the garment with every chosen feature),
 * `partial` (the garment, but `differs` lists what is different) or `none` (no slot of that garment).
 */
export const designMatchSchema = z
  .object({ level: z.enum(['full', 'partial', 'none']), differs: z.array(designMatchAttributeSchema) })
  .strict();
export type DesignMatch = z.infer<typeof designMatchSchema>;

export const LOOK_IMAGE_STATUSES = ['ready', 'on_request'] as const;
export const lookImageStatusSchema = z.enum(LOOK_IMAGE_STATUSES);
export type LookImageStatus = z.infer<typeof lookImageStatusSchema>;

export const lookSchema = z
  .object({
    id: objectIdSchema,
    status: outfitStatusSchema,
    templateId: templateIdSchema,
    paletteId: paletteIdSchema,
    slots: z
      .array(lookSlotSchema)
      .min(1)
      .refine((slots) => new Set(slots.map((s) => s.slotId)).size === slots.length, {
        message: 'slotId must be unique within a look',
      }),
    explanation: z.string().trim().min(1),
    explanationRefs: explanationRefsSchema,
    combinationSignature: z.string().min(1),
    /** `null` unless optional AI wording was used (FR-LOOK-16). */
    aiModel: z.string().min(1).nullable(),
    feedback: lookFeedbackSchema.nullable().optional(),
    /** The look's AI outfit image: stored (`ready`), made on first view (`on_request`), or none. */
    image: lookImageStatusSchema.nullable().optional(),
    /** Present only on looks requested with a `design`. */
    designMatch: designMatchSchema.nullable().optional(),
    source: outfitSourceSchema.optional(),
  })
  .strict();
export type Look = z.infer<typeof lookSchema>;

// --- Response --------------------------------------------------------------------------------------

/** Two explicit preferences that conflict; the more restrictive one applies (FR-LOOK-10). */
export const preferenceConflictSchema = z.object({ field: z.string().min(1), value: z.string().min(1) }).strict();
/** The constraint that limited the results and a suggested relaxation (FR-LOOK-11). */
export const limitedBySchema = z.object({ constraint: z.string().min(1), suggestion: z.string().min(1) }).strict();

export const MAX_LOOKS = 3;

/** `POST /v1/recommendations` data. Fewer looks (even none) is a success, never padded (FR-LOOK-11). */
export const recommendationResponseSchema = z
  .object({
    recommendationId: objectIdSchema,
    looks: z.array(lookSchema.refine((look) => look.status === 'suggested')).max(MAX_LOOKS),
    /** Names of the optional inputs that fell back to defaults (FR-LOOK-09). */
    defaultsApplied: z.array(z.string().min(1)),
    conflicts: z.array(preferenceConflictSchema),
    limitedBy: limitedBySchema.optional(),
  })
  .strict();
export type RecommendationResponse = z.infer<typeof recommendationResponseSchema>;

// --- Saved looks -------------------------------------------------------------------------------------

/** `GET /v1/outfits` query (FR-OUT-02). */
export const outfitListQuerySchema = paginationQuerySchema.extend({
  status: outfitStatusSchema.default('saved'),
  /** Only looks created in this feature (#115); all looks when absent. */
  source: outfitSourceSchema.optional(),
});
export type OutfitListQuery = z.infer<typeof outfitListQuerySchema>;

/** `GET /v1/outfits` data: one page of the user's looks, newest first, and how many there are in all. */
export const outfitListResponseSchema = z
  .object({
    looks: z.array(lookSchema),
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(50),
    total: z.number().int().min(0),
  })
  .strict()
  .refine((list) => list.looks.length <= list.limit, { message: 'More looks than the page limit' });
export type OutfitListResponse = z.infer<typeof outfitListResponseSchema>;

/**
 * The profile inputs a look was generated from, stored with it (DATABASE.md §3.4) so regenerate (#49)
 * can say what changed. Sizes are named by group only, and appearance signals only as used or not.
 */
export const lookInputsSchema = z
  .object({
    department: departmentSchema.nullable(),
    departmentFiltered: z.boolean(),
    likedColors: z.array(colorIdSchema),
    dislikedColors: z.array(colorIdSchema),
    contrastPreference: contrastPreferenceSchema.nullable(),
    silhouettePreferences: z.array(silhouetteSchema),
    fitPreferences: z.object(
      Object.fromEntries(FIT_GROUPS.map((g) => [g, fitSchema.nullable()])) as Record<
        (typeof FIT_GROUPS)[number],
        z.ZodNullable<typeof fitSchema>
      >,
    ),
    coveragePreferences: z.object({
      minSleeveLength: sleeveLengthSchema.nullable(),
      minNecklineCoverage: necklineDepthSchema.nullable(),
      minGarmentLength: garmentLengthSchema.nullable(),
    }),
    fabricPreferences: z.object({ liked: z.array(fabricSchema), avoided: z.array(fabricSchema) }),
    preferredStyles: z.array(styleSchema),
    sizesSaved: z.array(z.enum(SIZED_GROUPS_STAGE_1)),
    // The height band used (D-131), never the height itself; absent on looks made before it existed.
    heightBand: heightBandSchema.nullable().optional(),
    signalsUsed: z.boolean(),
  })
  .strict();
export type LookInputs = z.infer<typeof lookInputsSchema>;

/**
 * `GET /v1/outfits/:id`: the look with the user's items attached to its slots and, when any are
 * attached, a price summary computed on read (FR-OUT-02, FR-BUD-07).
 */
export const outfitDetailSchema = lookSchema.extend({
  userItems: z.array(userShortlistItemSchema),
  priceSummary: userPriceSummarySchema.optional(),
  /** The request the look was generated for, so regenerate (#49) can run it again. */
  request: recommendationRequestSchema,
  inputsUsed: lookInputsSchema,
});
export type OutfitDetail = z.infer<typeof outfitDetailSchema>;

/** `POST /v1/outfits/:id/feedback`. A reason is only given with "not for me". */
export const outfitFeedbackRequestSchema = z
  .object({ value: feedbackValueSchema, reason: feedbackReasonSchema.optional() })
  .strict()
  .refine((f) => f.reason === undefined || f.value === 'not_for_me', {
    message: 'A reason can only be given with "not for me"',
    path: ['reason'],
  });
export type OutfitFeedbackRequest = z.infer<typeof outfitFeedbackRequestSchema>;

export const feedbackRecordedResponseSchema = z.object({ recorded: z.literal(true) }).strict();
export type FeedbackRecordedResponse = z.infer<typeof feedbackRecordedResponseSchema>;

export interface DeletedResponse {
  deleted: true;
}

// --- Price range from store search results (#118) ---------------------------------------------------

/** The stores whose search listings make up a look's price range. */
export const PRICE_RANGE_STORES = [
  { id: 'amazon', label: 'Amazon' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'meesho', label: 'Meesho' },
] as const;
export const PRICE_RANGE_STORE_IDS = PRICE_RANGE_STORES.map((s) => s.id) as [
  (typeof PRICE_RANGE_STORES)[number]['id'],
  ...(typeof PRICE_RANGE_STORES)[number]['id'][],
];
export const priceRangeStoreSchema = z.enum(PRICE_RANGE_STORE_IDS);
export type PriceRangeStore = z.infer<typeof priceRangeStoreSchema>;

/** Shown next to every range: these are third-party search results, not StyleMe prices. */
export const PRICE_RANGE_LABEL =
  'Prices from Amazon, Flipkart and Meesho search results. Prices change; not verified by StyleMe; not a checkout price.';

/** One garment of the look: the lowest and highest listing price found, or null when none was found. */
export const slotPriceRangeSchema = z
  .object({
    slotId: slotIdSchema,
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    listings: z.number().int().min(0),
    stores: z.array(priceRangeStoreSchema),
  })
  .strict()
  .refine((s) => (s.listings === 0) === (s.min === null && s.max === null), {
    message: 'A slot has a range exactly when it has listings',
  })
  .refine((s) => s.min === null || s.max === null || s.min <= s.max, { message: 'min must not exceed max' });
export type SlotPriceRange = z.infer<typeof slotPriceRangeSchema>;

/**
 * `GET /v1/outfits/:id/price-range` data: per garment, the range of real listing prices on Amazon, Flipkart
 * and Meesho; for the look, the sum of the garment minimums to the sum of the maximums over the garments
 * with listings. `min`/`max` are null when no garment has any. Never a made-up or default price.
 */
export const lookPriceRangeSchema = z
  .object({
    currency: z.literal('INR'),
    priceBasis: z.literal('search_results'),
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    pricedSlots: z.number().int().min(0),
    totalSlots: z.number().int().min(1),
    slots: z.array(slotPriceRangeSchema).min(1),
    stores: z.array(priceRangeStoreSchema),
    /** When the oldest of the search results used was fetched (results are cached for a day). */
    checkedAt: z.iso.datetime(),
    label: z.literal(PRICE_RANGE_LABEL),
  })
  .strict();
export type LookPriceRange = z.infer<typeof lookPriceRangeSchema>;

// --- Matching products from store search results (#120) ---------------------------------------------

/** Shown with every product list: similar items from search, never claimed as exact matches. */
export const PRODUCT_MATCHES_LABEL =
  'Similar items found by search on Amazon, Flipkart and Meesho — not exact matches. Prices change; not verified by StyleMe; not a checkout price.';

/** At most this many of the cheapest listings per store are returned for each garment. */
export const PRODUCTS_PER_STORE = 8;

/** One listing as the search returned it: the store's title and price, a Google Shopping link and thumbnail. */
export const productListingSchema = z
  .object({
    store: priceRangeStoreSchema,
    title: z.string().trim().min(1).max(200),
    price: z.number().nonnegative(),
    /** Google Shopping page for the listing (https://www.google.com only); null when none was given. */
    link: z.url({ protocol: /^https$/, hostname: /^www\.google\.com$/ }).nullable(),
    /** Google-hosted thumbnail (https://*.gstatic.com only); null when none was given. */
    imageUrl: z.url({ protocol: /^https$/, hostname: /\.gstatic\.com$/ }).nullable(),
  })
  .strict();
export type ProductListing = z.infer<typeof productListingSchema>;

export const storePriceStatsSchema = z
  .object({
    store: priceRangeStoreSchema,
    listings: z.number().int().min(1),
    min: z.number().nonnegative(),
    median: z.number().nonnegative(),
    max: z.number().nonnegative(),
  })
  .strict();
export type StorePriceStats = z.infer<typeof storePriceStatsSchema>;

/** One garment: its cheapest listings per store, cheapest first, and price stats per store found. */
/** The parts of a garment's `lookSpec` that a listing's title can be matched on (#133). */
export const LOOK_SPEC_ATTRIBUTES = [
  'category',
  'color',
  'fabric',
  'fit',
  'silhouette',
  'neckline',
  'sleeve',
  'length',
  'pattern',
] as const;
export const lookSpecAttributeSchema = z.enum(LOOK_SPEC_ATTRIBUTES);
export type LookSpecAttribute = z.infer<typeof lookSpecAttributeSchema>;

/** A listing that matches the look: which of the garment's attributes its store title mentions (#133). */
export const matchedListingSchema = productListingSchema.extend({ matched: z.array(lookSpecAttributeSchema) }).strict();
export type MatchedListing = z.infer<typeof matchedListingSchema>;

/** At most this many other styles of the same garment per store (#133). */
export const ALTERNATIVES_PER_STORE = 4;

/**
 * One garment. `listings`: items that match the look, best match first (the most of its attributes found in
 * the title), then cheapest. `alternatives`: other styles of the same garment type, cheapest first, never
 * repeating a match. `stats`: price spread per store over the matching search.
 */
export const slotProductsSchema = z
  .object({
    slotId: slotIdSchema,
    listings: z.array(matchedListingSchema).max(PRODUCTS_PER_STORE * PRICE_RANGE_STORE_IDS.length),
    alternatives: z.array(productListingSchema).max(ALTERNATIVES_PER_STORE * PRICE_RANGE_STORE_IDS.length),
    stats: z.array(storePriceStatsSchema),
  })
  .strict();
export type SlotProducts = z.infer<typeof slotProductsSchema>;

/** `GET /v1/outfits/:id/products` data: similar products for each garment of the look (#120). */
export const lookProductMatchesSchema = z
  .object({
    currency: z.literal('INR'),
    priceBasis: z.literal('search_results'),
    slots: z.array(slotProductsSchema).min(1),
    checkedAt: z.iso.datetime(),
    label: z.literal(PRODUCT_MATCHES_LABEL),
  })
  .strict();
export type LookProductMatches = z.infer<typeof lookProductMatchesSchema>;

/** A product the user picked for one garment of the look (#120), stored on the look. */
export const lookPickSchema = productListingSchema
  .extend({ slotId: slotIdSchema, pickedAt: z.iso.datetime() })
  .strict();
export type LookPick = z.infer<typeof lookPickSchema>;

/** `PUT /v1/outfits/:id/picks`: pick one of the listings returned for that garment (replaces an earlier pick). */
export const pickProductRequestSchema = z.object({ slotId: slotIdSchema, listing: productListingSchema }).strict();
export type PickProductRequest = z.infer<typeof pickProductRequestSchema>;

/** `GET`, `PUT` and `DELETE /v1/outfits/:id/picks…` data: the look's picks, one per garment at most. */
export const lookPicksResponseSchema = z.object({ picks: z.array(lookPickSchema) }).strict();
export type LookPicksResponse = z.infer<typeof lookPicksResponseSchema>;
