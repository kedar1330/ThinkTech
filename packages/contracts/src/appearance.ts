import { z } from 'zod';
import { monkRangeSchema, proportionDescriptorSchema, undertoneSchema } from './style-vocabulary';

// Self-reported appearance signals (FR-SIG-01 … 07, API.md §3.3, DATABASE.md §3.3 and §5).
// Signals are optional, soft styling inputs: they never restrict choices, never set a size, and are
// never sent to an external AI provider.

export const skinToneValueSchema = z.object({ monkRange: monkRangeSchema }).strict();
export type SkinToneValue = z.infer<typeof skinToneValueSchema>;

/** One attribute in an update: a new value, or `null` to clear it. */
function attributeUpdate<T extends z.ZodType>(value: T) {
  return z.object({ value: value.nullable() }).strict();
}

export const updateAppearanceRequestSchema = z
  .object({
    skinTone: attributeUpdate(skinToneValueSchema).optional(),
    undertone: attributeUpdate(undertoneSchema).optional(),
    bodyProportions: attributeUpdate(proportionDescriptorSchema).optional(),
    useInRecommendations: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateAppearanceRequest = z.infer<typeof updateAppearanceRequestSchema>;

/**
 * A stored attribute (DATABASE.md §5). Self-reported values carry no confidence; `estimate` is
 * always `null` until photo analysis exists (deferred, D-76).
 */
export interface AppearanceAttribute<T> {
  value: T;
  source: 'self_reported';
  userConfirmed: true;
  confirmedAt: string;
  estimate: null;
}

export interface AppearanceResponse {
  skinTone: AppearanceAttribute<SkinToneValue> | null;
  undertone: AppearanceAttribute<z.infer<typeof undertoneSchema>> | null;
  bodyProportions: AppearanceAttribute<z.infer<typeof proportionDescriptorSchema>> | null;
  useInRecommendations: boolean;
}
