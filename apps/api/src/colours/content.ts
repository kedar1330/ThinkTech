import { z } from 'zod';
import { LIBRARY_UNDERTONE_IDS } from '@styleme/contracts';
import { findJudgementalLanguage } from '../style-rules/inclusive-language';

// The reviewable part of the colour library (D-133): which hues each undertone leans towards, and every
// sentence shown to users. It is styling content (CONTRIBUTING.md §6): the draft lives in
// `style-rules-drafts/colour-library.json`, and only a founder-approved copy goes in
// `src/style-rules/data/colour-library.json`. The scoring arithmetic is in `library.ts`.

const sentence = z
  .string()
  .trim()
  .min(10)
  .max(400)
  .refine((s) => findJudgementalLanguage(s).length === 0, 'Judgemental language (FR-STY-05)');

const hueCentreSchema = z
  .object({
    /** OKLCH hue in degrees. */
    hue: z.number().min(0).max(360),
    /** 0 – 1: how strongly the undertone leans to this hue. */
    weight: z.number().min(0).max(1),
    /** Shown as the reason when this hue is the closest match. */
    note: sentence,
  })
  .strict();

const undertoneContentSchema = z
  .object({
    rationale: sentence,
    /** Floor for every hue (neutral undertones wear most hues); 0 when only the listed hues count. */
    baseHueScore: z.number().min(0).max(1),
    hues: z.array(hueCentreSchema).min(3),
    /** The reason given for whites, greys, blacks and other near-neutral colours. */
    neutralNote: sentence,
  })
  .strict();

export const colourLibraryContentSchema = z
  .object({
    id: z.literal('CLIB-001'),
    version: z.number().int().min(1),
    reviewStatus: z.enum(['draft', 'approved']),
    reviewedBy: z.string().min(1).nullable(),
    reviewedAt: z.iso.date().nullable(),
    /** At least 100 colours per skin tone and undertone (founder target). */
    coloursPerCategory: z.number().int().min(100).max(300),
    /** At most this many colours from one family, so each category spans the spectrum. */
    familyCap: z.number().int().min(8).max(60),
    undertones: z
      .object({
        warm: undertoneContentSchema,
        cool: undertoneContentSchema,
        neutral: undertoneContentSchema,
        olive: undertoneContentSchema,
      })
      .strict() satisfies z.ZodType<Record<(typeof LIBRARY_UNDERTONE_IDS)[number], unknown>>,
    depthGroups: z.object({ light: sentence, medium: sentence, deep: sentence }).strict(),
    limitations: sentence,
  })
  .strict()
  .refine((c) => (c.reviewStatus === 'approved') === (c.reviewedBy !== null && c.reviewedAt !== null), {
    message: 'An approved library names who approved it and when; a draft names neither',
  });

export type ColourLibraryContent = z.infer<typeof colourLibraryContentSchema>;
export type UndertoneContent = z.infer<typeof undertoneContentSchema>;
