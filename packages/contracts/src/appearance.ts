import { z } from 'zod';
import { bodyTypeSchema, type BodyType } from './my-profile';
import type { AppearanceAnalysisSummary, ConfidenceLabel, UserPhoto } from './photos';
import { monkRangeSchema, proportionDescriptorSchema, undertoneSchema } from './style-vocabulary';

// Appearance (FR-SIG-01 … 07, API.md §3.3, DATABASE.md §3.3 and §5, D-129). Skin tone, undertone and body
// type are chosen by the user, estimated from a photo by Gemini (D-129), or (body type only) identified
// from the user's measurements. Every value is a soft styling input: it never restricts choices and never
// sets a size. A photo or measurement result is stored straight away and shown for review; the user can
// confirm it or correct it at any time.

export const skinToneValueSchema = z.object({ monkRange: monkRangeSchema }).strict();
export type SkinToneValue = z.infer<typeof skinToneValueSchema>;

/** One attribute in an update: a new value, or `null` to clear it. */
function attributeUpdate<T extends z.ZodType>(value: T) {
  return z.object({ value: value.nullable() }).strict();
}

/**
 * `PUT /v1/appearance`: the user's own choice (manual selection or a correction of a result). Setting
 * `bodyType` also sets `bodyProportions` to the matching descriptor (`bodyTypeProportion`).
 */
export const updateAppearanceRequestSchema = z
  .object({
    skinTone: attributeUpdate(skinToneValueSchema).optional(),
    undertone: attributeUpdate(undertoneSchema).optional(),
    bodyProportions: attributeUpdate(proportionDescriptorSchema).optional(),
    bodyType: attributeUpdate(bodyTypeSchema).optional(),
    useInRecommendations: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateAppearanceRequest = z.infer<typeof updateAppearanceRequestSchema>;

export const REVIEWABLE_ATTRIBUTES = ['skinTone', 'undertone', 'bodyType'] as const;
export type ReviewableAttribute = (typeof REVIEWABLE_ATTRIBUTES)[number];

/** `POST /v1/appearance/confirm`: the user reviewed a photo or measurement result and it is right. */
export const confirmAppearanceRequestSchema = z
  .object({ attributes: z.array(z.enum(REVIEWABLE_ATTRIBUTES)).min(1).max(3) })
  .strict();
export type ConfirmAppearanceRequest = z.infer<typeof confirmAppearanceRequestSchema>;

/**
 * Where a value came from: the user's own choice, a photo estimate, the user's measurements, or the
 * user's correction of an estimate.
 */
export const ATTRIBUTE_SOURCES = ['self_reported', 'photo_estimate', 'measurements', 'user_corrected'] as const;
export type AttributeSource = (typeof ATTRIBUTE_SOURCES)[number];

/**
 * A stored attribute (DATABASE.md §5). Self-reported and corrected values are confirmed and carry no
 * confidence. Photo and measurement results start with `userConfirmed: false` until the user reviews them.
 */
export interface AppearanceAttribute<T> {
  value: T;
  source: AttributeSource;
  userConfirmed: boolean;
  confirmedAt: string | null;
  /** The analysis behind a photo or measurement result; null for the user's own choice. */
  estimate: { analysisId: string; confidence: ConfidenceLabel | null } | null;
}

export interface AppearanceResponse {
  skinTone: AppearanceAttribute<SkinToneValue> | null;
  undertone: AppearanceAttribute<z.infer<typeof undertoneSchema>> | null;
  bodyProportions: AppearanceAttribute<z.infer<typeof proportionDescriptorSchema>> | null;
  bodyType: AppearanceAttribute<BodyType> | null;
  useInRecommendations: boolean;
}

/** `POST /v1/photos`: the stored photo, the analysis and the updated appearance, returned at once. */
export interface PhotoAnalysisResponse {
  photo: UserPhoto;
  analysis: AppearanceAnalysisSummary;
  appearance: AppearanceResponse;
}
