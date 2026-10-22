import { z } from 'zod';
import {
  FABRIC_IDS,
  FIT_IDS,
  GARMENT_LENGTH_IDS,
  NECKLINE_IDS,
  PATTERN_IDS,
  SILHOUETTE_IDS,
  SLEEVE_LENGTH_IDS,
  fabricSchema,
  fitSchema,
  occasionSchema,
  wearTypeSchema,
  type ProportionDescriptor,
} from './style-vocabulary';

// Shared styling catalogue (FRD §4.17 – §4.20, DATABASE.md §4a, decisions D-110 … D-114).
// Specified 2026-10-18; no endpoint uses these yet. The catalogue reuses the style vocabulary (D-09) for
// attribute values that already exist; new values are added to the vocabulary with founder approval (D-62).

// --- Identifiers ------------------------------------------------------------------------------------------

/** A reusable clothing-style record (e.g. "V-neck" for women's tops), linked to many body shapes (D-111). */
export const clothingStyleIdSchema = z.string().regex(/^CST-\d{3,}$/);
/** An illustration or image asset with recorded rights (D-113). */
export const illustrationIdSchema = z.string().regex(/^ILL-\d{3,}$/);
/** Hierarchy node key: lower-case kebab-case slug, unique (e.g. `women-tops-necklines`). */
export const catalogueKeySchema = z
  .string()
  .max(80)
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'Use a lower-case kebab-case key');

// --- Publication -----------------------------------------------------------------------------------------

/**
 * Lifecycle of every shared catalogue record (admin panel, D-120). Only `published` records are served to
 * users. Archived records stay readable by ID so saved items never break (FR-SAVE-21).
 */
export const CATALOGUE_STATUSES = ['draft', 'published', 'archived'] as const;
export const catalogueStatusSchema = z.enum(CATALOGUE_STATUSES);
export type CatalogueStatus = z.infer<typeof catalogueStatusSchema>;

/** Styling content needs founder approval before it can be published (D-62, D-120). */
export const REVIEW_STATUSES = ['draft', 'reviewed', 'approved'] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

// --- Catalogue departments and hierarchy (Outfit Categories Q8 – Q10) ------------------------------------

/** The catalogue has separate Women and Men sections only; a profile department `any` sees both. */
export const CATALOGUE_DEPARTMENTS = ['women', 'men'] as const;
export const catalogueDepartmentSchema = z.enum(CATALOGUE_DEPARTMENTS);
export type CatalogueDepartment = z.infer<typeof catalogueDepartmentSchema>;

/** Department → clothing group → category → subcategory; styles hang off a category or subcategory. */
export const CATALOGUE_LEVELS = ['department', 'group', 'category', 'subcategory'] as const;
export const catalogueLevelSchema = z.enum(CATALOGUE_LEVELS);
export type CatalogueLevel = z.infer<typeof catalogueLevelSchema>;

// --- Garment attributes (Outfit Categories Q11 – Q13, Discover My Style Q12) -----------------------------

/**
 * The attribute dimensions a clothing style can be described by. `values` names the shared vocabulary list
 * that holds the allowed values; `null` means the value list is still to be added to the vocabulary with
 * founder approval (D-62) — until then no style may use that attribute.
 */
export const GARMENT_ATTRIBUTES = [
  { id: 'neckline', label: 'Neckline', values: NECKLINE_IDS },
  { id: 'collar', label: 'Collar', values: null },
  { id: 'sleeve_length', label: 'Sleeve length', values: SLEEVE_LENGTH_IDS },
  { id: 'sleeve_design', label: 'Sleeve design', values: null },
  { id: 'shoulder', label: 'Shoulder style', values: null },
  { id: 'length', label: 'Garment length', values: GARMENT_LENGTH_IDS },
  { id: 'hem', label: 'Hem', values: null },
  { id: 'fit', label: 'Fit', values: FIT_IDS },
  { id: 'silhouette', label: 'Silhouette', values: SILHOUETTE_IDS },
  { id: 'fabric', label: 'Fabric', values: FABRIC_IDS },
  { id: 'drape', label: 'Drape', values: null },
  { id: 'pattern', label: 'Pattern', values: PATTERN_IDS },
  { id: 'rise', label: 'Rise', values: null },
  { id: 'waistband', label: 'Waistband', values: null },
  { id: 'leg_shape', label: 'Leg shape', values: null },
  { id: 'skirt_shape', label: 'Skirt shape', values: null },
  { id: 'waist_placement', label: 'Waist placement', values: null },
  { id: 'layering', label: 'Layering and drape (dupatta, stole)', values: null },
] as const;
export const GARMENT_ATTRIBUTE_IDS = GARMENT_ATTRIBUTES.map((a) => a.id) as [
  (typeof GARMENT_ATTRIBUTES)[number]['id'],
  ...(typeof GARMENT_ATTRIBUTES)[number]['id'][],
];
export const garmentAttributeIdSchema = z.enum(GARMENT_ATTRIBUTE_IDS);
export type GarmentAttributeId = z.infer<typeof garmentAttributeIdSchema>;

// --- Body shapes (D-112) -------------------------------------------------------------------------------

/**
 * Body-shape reference sets named in the requirements. They are flexible styling references, never
 * restrictions or judgements (FR-STY-05). Each maps to the self-described proportion descriptor it
 * corresponds to, so existing appearance signals keep working. More shapes are added only with founder
 * approval. Labels still pass the inclusive-language check before release.
 */
export const BODY_SHAPES = [
  {
    id: 'hourglass',
    label: 'Hourglass',
    departments: ['women'],
    proportion: 'balanced_defined_waist',
  },
  {
    id: 'pear',
    label: 'Pear (triangle)',
    departments: ['women'],
    proportion: 'hips_wider_than_shoulders',
  },
  {
    id: 'triangle',
    label: 'Triangle',
    departments: ['men'],
    proportion: 'hips_wider_than_shoulders',
  },
  {
    id: 'inverted_triangle',
    label: 'Inverted triangle',
    departments: ['women', 'men'],
    proportion: 'shoulders_wider_than_hips',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    departments: ['women', 'men'],
    proportion: 'balanced_straight_waist',
  },
  { id: 'apple', label: 'Apple (oval)', departments: ['women'], proportion: 'fuller_midsection' },
  { id: 'oval', label: 'Oval', departments: ['women', 'men'], proportion: 'fuller_midsection' },
  // My Profile body types (D-129, founder list 2026-10-22).
  { id: 'top_hourglass', label: 'Top hourglass', departments: ['women'], proportion: 'balanced_defined_waist' },
  { id: 'bottom_hourglass', label: 'Bottom hourglass', departments: ['women'], proportion: 'balanced_defined_waist' },
  { id: 'spoon', label: 'Spoon', departments: ['women'], proportion: 'hips_wider_than_shoulders' },
  { id: 'diamond', label: 'Diamond', departments: ['women'], proportion: 'fuller_midsection' },
  { id: 'trapezoid', label: 'Trapezoid', departments: ['men'], proportion: 'shoulders_wider_than_hips' },
  { id: 'not_sure', label: 'Not sure', departments: ['women', 'men'], proportion: null },
] as const satisfies readonly {
  id: string;
  label: string;
  departments: readonly CatalogueDepartment[];
  proportion: Exclude<ProportionDescriptor, 'prefer_not_to_say'> | null;
}[];
export const BODY_SHAPE_IDS = BODY_SHAPES.map((s) => s.id) as [
  (typeof BODY_SHAPES)[number]['id'],
  ...(typeof BODY_SHAPES)[number]['id'][],
];
export const bodyShapeSchema = z.enum(BODY_SHAPE_IDS);
export type BodyShape = z.infer<typeof bodyShapeSchema>;

// --- Styling goals (Outfit Categories Q22) ---------------------------------------------------------------

export const STYLING_GOALS = [
  { id: 'taller_silhouette', label: 'Create a taller-looking silhouette' },
  { id: 'balanced_silhouette', label: 'Create a more balanced-looking silhouette' },
  { id: 'define_waist', label: 'Emphasise or define the waist' },
  { id: 'adjust_emphasis', label: 'Add or reduce visual emphasis on selected areas' },
  { id: 'longer_line', label: 'Create a longer-looking torso or leg line' },
  { id: 'add_structure', label: 'Add structure or visual volume where desired' },
  { id: 'relaxed_comfort', label: 'Prefer relaxed, comfortable or less body-defining outfits' },
  { id: 'highlight_features', label: 'Highlight features I like' },
  { id: 'explore_freely', label: 'No body-related goal; explore styles freely' },
] as const;
export const STYLING_GOAL_IDS = STYLING_GOALS.map((g) => g.id) as [
  (typeof STYLING_GOALS)[number]['id'],
  ...(typeof STYLING_GOALS)[number]['id'][],
];
export const stylingGoalSchema = z.enum(STYLING_GOAL_IDS);
export type StylingGoal = z.infer<typeof stylingGoalSchema>;

// --- Illustrations and image rights (D-113, extends D-65) ------------------------------------------------

export const ILLUSTRATION_KINDS = [
  'croquis', // artistic editorial croquis: elongated figure, ink strokes, light watercolour
  'technical_flat', // garment-only technical drawing
  'body_shape_figure', // body-shape reference figure in a plain white shirt and plain white pants
  'tryon_model', // 2D try-on base model, clothed by default (D-119)
  'tryon_layer', // transparent garment layer for the 2D try-on
  'palette_mood', // palette imagery
  'editorial_photo', // curated, licensed fashion photograph (supplementary)
  'measurement_guide', // My Profile: how to take one body measurement, on a figure in white shirt and pants (D-129)
  'undertone_guide', // My Profile: hand showing an undertone (D-129)
  'design_feature', // Outfit Categories: one neckline, sleeve … on a dress form (D-132)
  'design_feature_layer', // transparent layer of one feature, stacked by the visual customizer (D-132)
] as const;
export const illustrationKindSchema = z.enum(ILLUSTRATION_KINDS);
export type IllustrationKind = z.infer<typeof illustrationKindSchema>;

export const ILLUSTRATION_VIEWS = ['front', 'back', 'side', 'detail'] as const;
export const illustrationViewSchema = z.enum(ILLUSTRATION_VIEWS);

/** Permitted sources (D-65). Anything else — including retailer or scraped images — is never published. */
export const ASSET_RIGHTS_SOURCES = [
  'team_made',
  'commissioned',
  'cc0',
  'cc_by',
  'licensed_in_writing',
  'code_generated',
  'ai_tool_permitted',
] as const;
export const assetRightsSourceSchema = z.enum(ASSET_RIGHTS_SOURCES);

/** Default clothing of every figure: never unclothed (D-113, D-119). */
export const DEFAULT_FIGURE_CLOTHING = 'plain_white_shirt_and_white_pants' as const;

// --- Palettes (My Colour Palette, D-109) ---------------------------------------------------------------

export const hexColourSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit HEX code such as #1A2B3C')
  .transform((hex) => hex.toUpperCase());

export const PALETTE_COLOUR_ROLES = ['primary', 'secondary', 'accent', 'neutral'] as const;
export const paletteColourRoleSchema = z.enum(PALETTE_COLOUR_ROLES);
export type PaletteColourRole = z.infer<typeof paletteColourRoleSchema>;

export const PALETTE_TEMPERATURES = ['warm', 'cool', 'neutral'] as const;
export const paletteTemperatureSchema = z.enum(PALETTE_TEMPERATURES);

export const SEASONAL_TYPES = ['spring', 'summer', 'autumn', 'winter'] as const;
export const seasonalTypeSchema = z.enum(SEASONAL_TYPES);

export const COLOUR_HARMONIES = [
  'monochrome',
  'tonal',
  'analogous',
  'complementary',
  'split_complementary',
  'triadic',
  'colour_block',
] as const;
export const colourHarmonySchema = z.enum(COLOUR_HARMONIES);

export const PALETTE_MOODS = ['minimal', 'elegant', 'bold', 'experimental'] as const;
export const paletteMoodSchema = z.enum(PALETTE_MOODS);

/** Custom palettes: a separate personal copy; the curated original never changes (D-109). */
export const CUSTOM_PALETTE_LIMITS = { nameMax: 60, minColours: 2, maxColours: 12, perUser: 100 } as const;

export const customPaletteColourSchema = z
  .object({
    hex: hexColourSchema,
    name: z.string().trim().min(1).max(40).optional(),
    role: paletteColourRoleSchema,
  })
  .strict();
export type CustomPaletteColour = z.infer<typeof customPaletteColourSchema>;

export const customPaletteSchema = z
  .object({
    name: z.string().trim().min(1).max(CUSTOM_PALETTE_LIMITS.nameMax),
    /** In display order; reordering rewrites the array. */
    colours: z
      .array(customPaletteColourSchema)
      .min(CUSTOM_PALETTE_LIMITS.minColours)
      .max(CUSTOM_PALETTE_LIMITS.maxColours),
    /** The curated palette this copy started from, or absent when created from scratch. */
    basedOnPaletteId: z
      .string()
      .regex(/^PAL-\d{3,}$/)
      .optional(),
  })
  .strict();
export type CustomPalette = z.infer<typeof customPaletteSchema>;

// --- Queries for Outfit Categories and Catalogue Endpoints (API.md §3.11, F1 - F4) -----------------------

export const catalogueCategoriesQuerySchema = z.object({
  department: catalogueDepartmentSchema.optional(),
  level: catalogueLevelSchema.optional(),
});
export type CatalogueCategoriesQuery = z.infer<typeof catalogueCategoriesQuerySchema>;

export const clothingStylesQuerySchema = z.object({
  department: catalogueDepartmentSchema.optional(),
  categoryId: z.string().optional(),
  categoryKey: z.string().optional(),
  bodyShape: bodyShapeSchema.optional(),
  goal: stylingGoalSchema.optional(),
  attribute: garmentAttributeIdSchema.optional(),
  value: z.string().optional(),
  fit: fitSchema.optional(),
  occasion: occasionSchema.optional(),
  wearType: wearTypeSchema.optional(),
  fabric: fabricSchema.optional(),
  q: z.string().trim().optional(),
  sort: z.enum(['best_match', 'name', 'recently_added']).default('best_match'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ClothingStylesQuery = z.infer<typeof clothingStylesQuerySchema>;

export const compareStylesQuerySchema = z.object({
  ids: z.string().min(1),
});
export type CompareStylesQuery = z.infer<typeof compareStylesQuerySchema>;

export interface CatalogueCategoryItem {
  key: string;
  name: string;
  description: string;
  level: CatalogueLevel;
  department: CatalogueDepartment;
  sortOrder?: number;
  wearTypes?: string[];
  garmentTypes?: string[];
  attributeIds?: string[];
}

export interface ClothingStyleItem {
  styleId: string;
  slug: string;
  name: string;
  description: string;
  department: CatalogueDepartment;
  categoryKey: string;
  definingAttribute?: { attributeId: string; valueId: string };
  attributes?: Array<{ attributeId: string; valueId: string }>;
  wearTypes?: string[];
  occasions?: string[];
  styles?: string[];
  stylingGoals?: string[];
  bodyShapes?: string[];
  explanation?: {
    summary: string;
    benefits: string[];
    tradeOffs: string[];
    stylingTips: string[];
  };
  illustrations?: Array<{
    illustrationId?: string;
    kind?: string;
    url?: string;
    alt?: string;
  }>;
}

export interface ClothingStylesResponse {
  items: ClothingStyleItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
