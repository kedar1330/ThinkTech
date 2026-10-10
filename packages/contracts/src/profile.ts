import { z } from 'zod';
import {
  colorIdSchema,
  comfortOptionSchema,
  contrastPreferenceSchema,
  departmentSchema,
  fabricSchema,
  fitSchema,
  garmentLengthSchema,
  necklineDepthSchema,
  occasionSchema,
  silhouetteSchema,
  sleeveLengthSchema,
  styleSchema,
  type ColorId,
  type ComfortOption,
  type ContrastPreference,
  type Department,
  type Fabric,
  type Fit,
  type GarmentLength,
  type NecklineDepth,
  type Occasion,
  type Silhouette,
  type SleeveLength,
  type Style,
} from './style-vocabulary';

// Style profile (FR-PROF-01 … 06, FR-SIZE-01 … 04, API.md §3.2, DATABASE.md §3.2).
// Only `department` is required. Age range, height and measurements are not collected in Stage 1
// (FR-PROF-04, FR-SIZE-06); the schema rejects them.

// --- Sizes per category group (D-54). Body shape and signals never set a size (FR-SIZE-03). -------

export const LETTER_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export const letterSizeSchema = z.enum(LETTER_SIZES);
export type LetterSize = z.infer<typeof letterSizeSchema>;

const inches = (min: number, max: number) => z.number().int().min(min).max(max);

/** Tops (T-shirts, shirts): letter size; shirts may also use a collar size in inches. */
export const topsSizeSchema = z
  .object({ letter: letterSizeSchema, collarIn: z.number().min(13).max(20).multipleOf(0.5).optional() })
  .strict();
/** Bottoms (jeans, trousers): waist in inches; optional inside-leg length in inches. */
export const bottomsSizeSchema = z.object({ waistIn: inches(24, 50), lengthIn: inches(26, 36).optional() }).strict();
/** Ethnic tops (kurtas, kurtis): letter size, or a numeric (chest) size where a retailer uses one. */
export const ethnicTopsSizeSchema = z
  .object({ letter: letterSizeSchema.optional(), numeric: inches(28, 54).optional() })
  .strict()
  .refine((s) => s.letter !== undefined || s.numeric !== undefined, { message: 'Give a letter or numeric size' });
/** Ethnic sets (lehengas): letter or waist size; often semi-stitched. */
export const ethnicSetsSizeSchema = z
  .object({ letter: letterSizeSchema.optional(), waistIn: inches(24, 50).optional() })
  .strict()
  .refine((s) => s.letter !== undefined || s.waistIn !== undefined, { message: 'Give a letter or waist size' });
/** Shoes: UK/India size. */
export const shoesSizeSchema = z.object({ uk: inches(1, 14) }).strict();

// Sarees and most accessories are free size (no size). Dresses join in Stage 2 (D-57).
export const SIZED_GROUPS_STAGE_1 = ['tops', 'bottoms', 'ethnicTops', 'ethnicSets', 'shoes'] as const;
export const FIT_GROUPS = ['tops', 'bottoms', 'ethnicTops', 'ethnicSets'] as const;

const nullableOptional = <T extends z.ZodType>(schema: T) => schema.nullable().optional();

export const profileSizesSchema = z
  .object({
    tops: nullableOptional(topsSizeSchema),
    bottoms: nullableOptional(bottomsSizeSchema),
    ethnicTops: nullableOptional(ethnicTopsSizeSchema),
    ethnicSets: nullableOptional(ethnicSetsSizeSchema),
    shoes: nullableOptional(shoesSizeSchema),
  })
  .strict();

export const fitPreferencesSchema = z
  .object({
    tops: nullableOptional(fitSchema),
    bottoms: nullableOptional(fitSchema),
    ethnicTops: nullableOptional(fitSchema),
    ethnicSets: nullableOptional(fitSchema),
  })
  .strict();

// --- Coverage: the least coverage the user is comfortable with (a hard constraint, FR-LOOK-08). ---
// Each vocabulary list is ordered from least to most coverage.
export const coveragePreferencesSchema = z
  .object({
    minSleeveLength: nullableOptional(sleeveLengthSchema),
    minNecklineCoverage: nullableOptional(necklineDepthSchema),
    minGarmentLength: nullableOptional(garmentLengthSchema),
  })
  .strict();

export const fabricPreferencesSchema = z
  .object({ liked: z.array(fabricSchema).max(20), avoided: z.array(fabricSchema).max(20) })
  .strict();

const uniqueList = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((list) => new Set(list).size === list.length, { message: 'Duplicate values' });

/** Optional per-look budget in whole rupees; compared only with totals of user-entered prices in Stage 1. */
export const budgetPreferenceSchema = z.number().int().positive().max(1_000_000);

/**
 * `PUT /v1/profile`. `department` is always required; every other field is optional — omitted fields
 * are unchanged and `null` clears a field (an empty list clears a list).
 */
export const updateProfileRequestSchema = z
  .object({
    department: departmentSchema,
    sizes: nullableOptional(profileSizesSchema),
    fitPreferences: nullableOptional(fitPreferencesSchema),
    likedColors: nullableOptional(uniqueList(colorIdSchema, 50)),
    dislikedColors: nullableOptional(uniqueList(colorIdSchema, 50)),
    contrastPreference: nullableOptional(contrastPreferenceSchema),
    silhouettePreferences: nullableOptional(uniqueList(silhouetteSchema, 20)),
    coveragePreferences: nullableOptional(coveragePreferencesSchema),
    comfortPreferences: nullableOptional(uniqueList(comfortOptionSchema, 20)),
    fabricPreferences: nullableOptional(fabricPreferencesSchema),
    preferredStyles: nullableOptional(uniqueList(styleSchema, 20)),
    preferredOccasions: nullableOptional(uniqueList(occasionSchema, 20)),
    budgetPreference: nullableOptional(budgetPreferenceSchema),
  })
  .strict();
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export interface ProfileSizes {
  tops: z.infer<typeof topsSizeSchema> | null;
  bottoms: z.infer<typeof bottomsSizeSchema> | null;
  ethnicTops: z.infer<typeof ethnicTopsSizeSchema> | null;
  ethnicSets: z.infer<typeof ethnicSetsSizeSchema> | null;
  shoes: z.infer<typeof shoesSizeSchema> | null;
}

/** `GET /v1/profile`. Before the user saves a profile, `department` is `null` and everything is empty. */
export interface ProfileResponse {
  department: Department | null;
  sizes: ProfileSizes;
  fitPreferences: Record<(typeof FIT_GROUPS)[number], Fit | null>;
  likedColors: ColorId[];
  dislikedColors: ColorId[];
  contrastPreference: ContrastPreference | null;
  silhouettePreferences: Silhouette[];
  coveragePreferences: {
    minSleeveLength: SleeveLength | null;
    minNecklineCoverage: NecklineDepth | null;
    minGarmentLength: GarmentLength | null;
  };
  comfortPreferences: ComfortOption[];
  fabricPreferences: { liked: Fabric[]; avoided: Fabric[] };
  preferredStyles: Style[];
  preferredOccasions: Occasion[];
  budgetPreference: number | null;
  updatedAt: string | null;
}
