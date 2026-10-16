import { z } from 'zod';

// Identifiers and list conventions shared by looks, palettes and the shortlist (API.md §1, D-18, D-82).

/** MongoDB ObjectId as a 24-character hex string (looks, recommendation batches, shortlist items). */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid ID');
export const templateIdSchema = z.string().regex(/^OUT-\d{3,}$/);
export const paletteIdSchema = z.string().regex(/^PAL-\d{3,}$/);
/** Stable slot ID from the template, unique within a look (D-82), e.g. `top`, `accessory-1`. */
export const slotIdSchema = z
  .string()
  .max(40)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'slotId is lower-case kebab-case');

/** Where "Shop my look" starts from a look's slot: `{ outfitId, slotId }` (FR-LIST-01, D-82). */
export const shopEntryPointSchema = z.object({ outfitId: objectIdSchema, slotId: slotIdSchema }).strict();
export type ShopEntryPoint = z.infer<typeof shopEntryPointSchema>;

/** `page` / `limit` on list endpoints: default 20, maximum 50 (D-18). Query strings are coerced. */
export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
