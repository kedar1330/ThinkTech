import { z } from 'zod';
import { UNDERTONES } from './style-vocabulary';

// Colour library (D-133, API.md §3.13): skin tone (Monk 1 – 10) → undertone (warm, cool, neutral, olive) →
// 100+ colours suggested for that combination. Colours come from openly licensed lists (CSS named colours and
// the CC0 xkcd colour survey) and are scored by deterministic colour-theory rules (OKLCH hue, chroma and
// contrast with the Monk swatch). Suggestions are a starting point, never a restriction. Each user sees only
// the category for their own skin tone and undertone, and can mark its colours as liked or avoided, many at once.

// --- Identifiers ------------------------------------------------------------------------------------------

/** `CLR-0001` … one per colour in the master list. */
export const colourIdSchema = z.string().regex(/^CLR-\d{4}$/, 'Use a colour ID such as CLR-0001');
export type ColourId = z.infer<typeof colourIdSchema>;

export const MONK_TONE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const monkToneSchema = z.number().int().min(1).max(10);

/** The four undertones the library is organised by ("not sure" has no category of its own). */
export const LIBRARY_UNDERTONE_IDS = ['warm', 'cool', 'neutral', 'olive'] as const;
export const libraryUndertoneSchema = z.enum(LIBRARY_UNDERTONE_IDS);
export type LibraryUndertone = z.infer<typeof libraryUndertoneSchema>;
export const LIBRARY_UNDERTONES = UNDERTONES.filter(
  (u): u is Extract<(typeof UNDERTONES)[number], { id: LibraryUndertone }> =>
    (LIBRARY_UNDERTONE_IDS as readonly string[]).includes(u.id),
);

/** `monk-06-warm`: one category per Monk tone and undertone (40 in all). */
export const colourCategoryIdSchema = z
  .string()
  .regex(/^monk-(0[1-9]|10)-(warm|cool|neutral|olive)$/, 'Use a category ID such as monk-06-warm');
export type ColourCategoryId = z.infer<typeof colourCategoryIdSchema>;

export function colourCategoryId(monkTone: number, undertone: LibraryUndertone): ColourCategoryId {
  return `monk-${String(monkTone).padStart(2, '0')}-${undertone}`;
}

export function parseColourCategoryId(id: string): { monkTone: number; undertone: LibraryUndertone } | null {
  const parsed = colourCategoryIdSchema.safeParse(id);
  if (!parsed.success) return null;
  const [, tone, undertone] = id.split('-');
  return { monkTone: Number(tone), undertone: undertone as LibraryUndertone };
}

export const COLOUR_CATEGORY_COUNT = MONK_TONE_IDS.length * LIBRARY_UNDERTONE_IDS.length;

// --- Describing a colour ----------------------------------------------------------------------------------

export const COLOUR_FAMILIES = [
  { id: 'red', label: 'Reds' },
  { id: 'pink', label: 'Pinks' },
  { id: 'orange', label: 'Oranges' },
  { id: 'yellow', label: 'Yellows and golds' },
  { id: 'green', label: 'Greens' },
  { id: 'teal', label: 'Teals' },
  { id: 'blue', label: 'Blues' },
  { id: 'purple', label: 'Purples' },
  { id: 'brown', label: 'Browns' },
  { id: 'beige', label: 'Beiges and creams' },
  { id: 'grey', label: 'Greys' },
  { id: 'black_white', label: 'Black and white' },
] as const;
export const COLOUR_FAMILY_IDS = COLOUR_FAMILIES.map((f) => f.id) as [
  (typeof COLOUR_FAMILIES)[number]['id'],
  ...(typeof COLOUR_FAMILIES)[number]['id'][],
];
export const colourFamilySchema = z.enum(COLOUR_FAMILY_IDS);
export type ColourFamily = z.infer<typeof colourFamilySchema>;

export const COLOUR_TEMPERATURES = ['warm', 'cool', 'neutral'] as const;
export type ColourTemperature = (typeof COLOUR_TEMPERATURES)[number];
export const COLOUR_DEPTHS = ['light', 'medium', 'deep'] as const;
export type ColourDepth = (typeof COLOUR_DEPTHS)[number];
export const COLOUR_INTENSITIES = ['soft', 'medium', 'bright'] as const;
export type ColourIntensity = (typeof COLOUR_INTENSITIES)[number];
export const COLOUR_SOURCES = ['css', 'xkcd'] as const;
export type ColourSource = (typeof COLOUR_SOURCES)[number];

/** Skin tone groups the rules speak to: Monk 1 – 3, 4 – 6 and 7 – 10. */
export const SKIN_DEPTH_GROUPS = [
  { id: 'light', label: 'Lighter skin', monkTones: [1, 2, 3] },
  { id: 'medium', label: 'Medium skin', monkTones: [4, 5, 6] },
  { id: 'deep', label: 'Deeper skin', monkTones: [7, 8, 9, 10] },
] as const;
export type SkinDepthGroup = (typeof SKIN_DEPTH_GROUPS)[number]['id'];
export function skinDepthGroup(monkTone: number): SkinDepthGroup {
  return monkTone <= 3 ? 'light' : monkTone <= 6 ? 'medium' : 'deep';
}

// --- Preferences ------------------------------------------------------------------------------------------

export const COLOUR_PREFERENCES = ['liked', 'avoided'] as const;
export const colourPreferenceSchema = z.enum(COLOUR_PREFERENCES);
export type ColourPreference = z.infer<typeof colourPreferenceSchema>;

export const COLOUR_LIBRARY_LIMITS = { perRequest: 200, saved: 600 } as const;

/**
 * `PUT /v1/colours/preferences`: mark the selected colours as liked or avoided, or `none` to clear them. A
 * colour is either liked or avoided, never both; the latest choice wins.
 */
export const updateColourPreferencesRequestSchema = z
  .object({
    colourIds: z.array(colourIdSchema).min(1).max(COLOUR_LIBRARY_LIMITS.perRequest),
    preference: z.enum([...COLOUR_PREFERENCES, 'none']),
  })
  .strict();
export type UpdateColourPreferencesRequest = z.infer<typeof updateColourPreferencesRequestSchema>;

// --- Responses --------------------------------------------------------------------------------------------

export interface ColourItem {
  colourId: ColourId;
  name: string;
  hex: string;
  family: ColourFamily;
  temperature: ColourTemperature;
  depth: ColourDepth;
  intensity: ColourIntensity;
  /** OKLCH: lightness 0 – 1, chroma 0 – ~0.4, hue in degrees. */
  oklch: { l: number; c: number; h: number };
  source: ColourSource;
  preference: ColourPreference | null;
}

export interface CategoryColourItem extends ColourItem {
  /** 0 – 100: how closely the colour follows the rules for this skin tone and undertone. */
  score: number;
  rank: number;
  reasons: string[];
}

export type ColourReviewStatus = 'approved' | 'draft';

export interface ColourCategorySummary {
  categoryId: ColourCategoryId;
  monkTone: number;
  undertone: LibraryUndertone;
  label: string;
  colourCount: number;
  /** The three top-ranked colours, for the card. */
  preview: Array<{ name: string; hex: string }>;
}

/**
 * Why the user has no colours yet: no skin tone or undertone in My Profile (or "not sure"), appearance
 * signals switched off, or no published category for their tone.
 */
export const MY_COLOURS_MISSING = ['skin_tone', 'undertone', 'signals_off', 'not_published'] as const;
export type MyColoursMissing = (typeof MY_COLOURS_MISSING)[number];

/**
 * `GET /v1/colours/mine`: only the user's own category (their Monk tone and undertone), never the others.
 * `category` is null, with `missing` saying why, until the profile has both.
 */
export interface MyColoursResponse {
  missing: MyColoursMissing | null;
  category:
    | (ColourCategorySummary & {
        skinHex: string;
        rationale: string;
        limitations: string;
        /** `draft` only outside production, before founder approval. */
        reviewStatus: ColourReviewStatus;
      })
    | null;
  families: Array<{ id: ColourFamily; label: string; count: number }>;
  colours: CategoryColourItem[];
  saved: { liked: number; avoided: number };
}

export interface ColourPreferencesResponse {
  liked: ColourItem[];
  avoided: ColourItem[];
  updatedAt: string | null;
}

// --- Coordinating colours and curated combinations (#105) -------------------------------------------------

/**
 * How the colours in a combination relate on the colour wheel. Combinations are built only from the user's own
 * category, by deterministic rules on OKLCH hue and lightness; avoided colours never appear.
 */
export const COMBINATION_HARMONIES = [
  { id: 'neutral_accent', label: 'Neutral and accent' },
  { id: 'tonal', label: 'Tonal' },
  { id: 'analogous', label: 'Analogous' },
  { id: 'complementary', label: 'Complementary' },
  { id: 'split_complementary', label: 'Split complementary' },
  { id: 'triadic', label: 'Triadic' },
] as const;
export type CombinationHarmony = (typeof COMBINATION_HARMONIES)[number]['id'];

/** Base (most of the outfit), accent, and an optional small pop of colour. */
export const COMBINATION_ROLES = ['base', 'accent', 'pop'] as const;
export type CombinationRole = (typeof COMBINATION_ROLES)[number];

export interface CombinationColour {
  colourId: ColourId;
  name: string;
  hex: string;
  role: CombinationRole;
  preference: ColourPreference | null;
}

export interface ColourCombination {
  /** Stable for the same colours: `CMB-` and the colour IDs. */
  combinationId: string;
  harmony: CombinationHarmony;
  colours: CombinationColour[];
  /** 0 – 100: how well the colours suit the user and each other. */
  score: number;
  reason: string;
  likedCount: number;
}

export interface CoordinatingColours {
  colourId: ColourId;
  /** Colours from the user's own category that go well with this one, best first. */
  matches: ColourId[];
}

/**
 * `GET /v1/colours/combinations`: coordinating colours and curated combinations from the user's own category.
 * Generated on first request and stored; rebuilt when the category or liked and avoided colours change.
 */
export interface MyColourCombinationsResponse {
  missing: MyColoursMissing | null;
  /** The colours referred to by `combinations` and `coordinating`, avoided ones excluded. */
  colours: Array<Pick<ColourItem, 'colourId' | 'name' | 'hex' | 'family' | 'preference'>>;
  harmonies: Array<{ id: CombinationHarmony; label: string; count: number }>;
  combinations: ColourCombination[];
  coordinating: CoordinatingColours[];
  generatedAt: string | null;
}
