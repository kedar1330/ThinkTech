import { z } from 'zod';
import {
  categorySchema,
  colorFamilySchema,
  colorIdSchema,
  fabricSchema,
  fitSchema,
  garmentLengthSchema,
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
import { userPriceSummarySchema, userShortlistItemSchema } from './product';

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
export const recommendationRequestSchema = z
  .object({
    occasion: occasionSchema,
    style: styleSchema.optional(),
    wearType: uniqueList(wearTypeSchema, 3).min(1).optional(),
    paletteMode: paletteModeSchema.default('suggested'),
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
export const illustrationSchema = z.object({ url: z.string().min(1), licenceLabel: z.string().trim().min(1) }).strict();

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
  })
  .strict();
export type Look = z.infer<typeof lookSchema>;

// --- Response --------------------------------------------------------------------------------------

/** Two explicit preferences that conflict; the more restrictive one applies (FR-LOOK-10). */
export const preferenceConflictSchema = z.object({ field: z.string().min(1), value: z.string().min(1) }).strict();
/** The constraint that limited the results and a suggested relaxation (FR-LOOK-11). */
export const limitedBySchema = z.object({ constraint: z.string().min(1), suggestion: z.string().min(1) }).strict();

export const MAX_LOOKS = 5;

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
export const outfitListQuerySchema = paginationQuerySchema.extend({ status: outfitStatusSchema.default('saved') });
export type OutfitListQuery = z.infer<typeof outfitListQuerySchema>;

/**
 * `GET /v1/outfits/:id`: the look with the user's items attached to its slots and, when any are
 * attached, a price summary computed on read (FR-OUT-02, FR-BUD-07).
 */
export const outfitDetailSchema = lookSchema.extend({
  userItems: z.array(userShortlistItemSchema),
  priceSummary: userPriceSummarySchema.optional(),
});
export type OutfitDetail = z.infer<typeof outfitDetailSchema>;

// --- Feedback (FR-OUT-04): no free text is collected ------------------------------------------------

export const FEEDBACK_VALUES = ['love_it', 'not_for_me'] as const;
export const feedbackValueSchema = z.enum(FEEDBACK_VALUES);

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

/** `POST /v1/outfits/:id/feedback`. A reason is only given with "not for me". */
export const outfitFeedbackRequestSchema = z
  .object({ value: feedbackValueSchema, reason: feedbackReasonSchema.optional() })
  .strict()
  .refine((f) => f.reason === undefined || f.value === 'not_for_me', {
    message: 'A reason can only be given with "not for me"',
    path: ['reason'],
  });
export type OutfitFeedbackRequest = z.infer<typeof outfitFeedbackRequestSchema>;

export interface FeedbackRecordedResponse {
  recorded: true;
}

export interface DeletedResponse {
  deleted: true;
}
