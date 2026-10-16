import { z } from 'zod';
import { paletteIdSchema } from './common';
import { swatchSchema } from './outfit';
import { contrastLevelSchema } from './style-vocabulary';

// `GET /v1/style/palettes` (FR-PAL-01 … 03, API.md §3.4).

export const PALETTE_VIEWS = ['suggested', 'all'] as const;
export const paletteListQuerySchema = z.object({ view: z.enum(PALETTE_VIEWS).default('suggested') }).strict();
export type PaletteListQuery = z.infer<typeof paletteListQuerySchema>;

export const paletteSummarySchema = z
  .object({
    id: paletteIdSchema,
    name: z.string().trim().min(1),
    neutrals: z.array(swatchSchema).min(1),
    accents: z.array(swatchSchema),
    combinations: z
      .array(z.object({ colors: z.array(swatchSchema).min(2).max(4), contrastLevel: contrastLevelSchema }).strict())
      .min(1),
    rationale: z.string().trim().min(1),
    limitations: z.string().trim().min(1),
    /** Preferences or enabled signals that ranked the palette; empty for `view=all`. */
    suggestedBecause: z.array(z.string().min(1)),
  })
  .strict();
export type PaletteSummary = z.infer<typeof paletteSummarySchema>;

export const paletteListResponseSchema = z.object({ palettes: z.array(paletteSummarySchema) }).strict();
export type PaletteListResponse = z.infer<typeof paletteListResponseSchema>;
