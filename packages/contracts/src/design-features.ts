import { z } from 'zod';
import { stylingGoalSchema } from './catalogue';
import {
  clothingPreferenceSchema,
  heightBandSchema,
  wearTypeSchema,
  type ClothingPreference,
} from './style-vocabulary';

// Design features (Outfit Categories → Sleeves & Necklines, D-132). The hierarchy is
// Clothing Preference (women / men) → outfit category (Indian, Western, Indo-Western: the wear types) →
// garment type → design feature category (neckline, sleeve, fit …) → individual feature (V-neck …).
// The catalogue lives in MongoDB (`outfitCategories`, `designFeatureCategories`, `designFeatures`); the
// suitability rules decide which features are shown to a user, from their body type, height band and goals.

// --- Identifiers ------------------------------------------------------------------------------------------

/** `<category>_<name>`, e.g. `neckline_v_neck`, `sleeve_bishop`. */
export const designFeatureIdSchema = z
  .string()
  .max(60)
  .regex(/^[a-z]+(_[a-z0-9]+)+$/, 'Use a feature ID such as neckline_v_neck');
export const garmentTypeIdSchema = z
  .string()
  .max(40)
  .regex(/^[a-z]+(_[a-z0-9]+)*$/);
export const suitabilityRuleIdSchema = z.string().regex(/^FSR-\d{3,}$/);

// --- Outfit categories: the wear types, labelled for this feature ---------------------------------------

export const OUTFIT_CATEGORIES = [
  { id: 'indian', label: 'Indian' },
  { id: 'western', label: 'Western' },
  { id: 'fusion', label: 'Indo-Western' },
] as const;
export const outfitCategorySchema = wearTypeSchema;
export type OutfitCategory = z.infer<typeof outfitCategorySchema>;

/** What a garment covers; decides which design feature categories apply and which rules match. */
export const GARMENT_KINDS = ['top', 'one_piece', 'bottom', 'layer', 'drape'] as const;
export const garmentKindSchema = z.enum(GARMENT_KINDS);
export type GarmentKind = z.infer<typeof garmentKindSchema>;

// --- Design feature categories ----------------------------------------------------------------------------

/**
 * How the selection page shows a category (the screenshot's four panels): `illustrated` cards with large
 * images (necklines), a compact image `grid` (sleeves) or `tags` (everything else).
 */
export const FEATURE_PRESENTATIONS = ['illustrated', 'grid', 'tags'] as const;
export type FeaturePresentation = (typeof FEATURE_PRESENTATIONS)[number];

export const DESIGN_FEATURE_CATEGORIES = [
  { id: 'neckline', label: 'Necklines and collars', presentation: 'illustrated', kinds: ['top', 'one_piece', 'layer'] },
  { id: 'sleeve', label: 'Sleeves', presentation: 'grid', kinds: ['top', 'one_piece', 'layer'] },
  { id: 'fit', label: 'Fit', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer'] },
  { id: 'length', label: 'Length', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer'] },
  { id: 'waistline', label: 'Waistline and rise', presentation: 'tags', kinds: ['one_piece', 'bottom'] },
  { id: 'silhouette', label: 'Silhouette', presentation: 'tags', kinds: ['top', 'one_piece'] },
  { id: 'leg_shape', label: 'Leg shape', presentation: 'tags', kinds: ['bottom'] },
  { id: 'waistband', label: 'Waistband', presentation: 'tags', kinds: ['bottom'] },
  { id: 'pleats', label: 'Pleats', presentation: 'tags', kinds: ['bottom'] },
  { id: 'bottom_hem', label: 'Trouser hem', presentation: 'tags', kinds: ['bottom'] },
  {
    id: 'pattern',
    label: 'Pattern and surface',
    presentation: 'tags',
    kinds: ['top', 'one_piece', 'bottom', 'layer', 'drape'],
  },
  { id: 'fabric', label: 'Fabric', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer', 'drape'] },
  { id: 'closure', label: 'Closure', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer'] },
  { id: 'collar', label: 'Collar', presentation: 'tags', kinds: ['top', 'one_piece', 'layer'] },
  { id: 'hemline', label: 'Hemline', presentation: 'tags', kinds: ['top', 'one_piece', 'layer'] },
  { id: 'pockets', label: 'Pockets', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer'] },
  { id: 'draping', label: 'Draping', presentation: 'tags', kinds: ['one_piece', 'drape'] },
  { id: 'layering', label: 'Layering', presentation: 'tags', kinds: ['top', 'one_piece', 'layer'] },
  { id: 'transparency', label: 'Transparency', presentation: 'tags', kinds: ['top', 'one_piece', 'drape'] },
  { id: 'stretch', label: 'Stretch', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom'] },
  { id: 'occasion', label: 'Occasion', presentation: 'tags', kinds: ['top', 'one_piece', 'bottom', 'layer', 'drape'] },
] as const satisfies readonly {
  id: string;
  label: string;
  presentation: FeaturePresentation;
  kinds: readonly GarmentKind[];
}[];
export const DESIGN_FEATURE_CATEGORY_IDS = DESIGN_FEATURE_CATEGORIES.map((c) => c.id) as [
  (typeof DESIGN_FEATURE_CATEGORIES)[number]['id'],
  ...(typeof DESIGN_FEATURE_CATEGORIES)[number]['id'][],
];
export const designFeatureCategorySchema = z.enum(DESIGN_FEATURE_CATEGORY_IDS);
export type DesignFeatureCategory = z.infer<typeof designFeatureCategorySchema>;

// --- Suitability (feature_suitability_rules) --------------------------------------------------------------

/** Soft outcomes only: a rule recommends or deprioritises, never forbids (FR-STY-04). */
export const SUITABILITY_RESULTS = ['recommended', 'alternative', 'not_preferred'] as const;
export const suitabilityResultSchema = z.enum(SUITABILITY_RESULTS);
export type SuitabilityResult = z.infer<typeof suitabilityResultSchema>;

export const RULE_CONFIDENCES = ['rule_based', 'validated', 'experimental'] as const;
export const ruleConfidenceSchema = z.enum(RULE_CONFIDENCES);

// --- User preferences and selections ----------------------------------------------------------------------

export const FEATURE_PREFERENCES = ['liked', 'disliked', 'explore', 'no_preference'] as const;
export const featurePreferenceSchema = z.enum(FEATURE_PREFERENCES);
export type FeaturePreference = z.infer<typeof featurePreferenceSchema>;

export const DESIGN_LIMITS = { featurePreferences: 400, selections: 50, otherAttributes: 20 } as const;

export const updateDesignPreferencesRequestSchema = z
  .object({
    featurePreferences: z
      .array(z.object({ featureId: designFeatureIdSchema, preference: featurePreferenceSchema }).strict())
      .max(DESIGN_LIMITS.featurePreferences)
      .optional(),
    stylingGoals: z.array(stylingGoalSchema).max(9).optional(),
    fitPreferences: z.array(designFeatureIdSchema).max(20).optional(),
    occasionPreferences: z.array(designFeatureIdSchema).max(20).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateDesignPreferencesRequest = z.infer<typeof updateDesignPreferencesRequestSchema>;

/** One feature per category, e.g. `{ neckline: 'neckline_square', sleeve: 'sleeve_full_length' }`. */
export const selectedFeaturesSchema = z.partialRecord(designFeatureCategorySchema, designFeatureIdSchema);
export type SelectedFeatures = z.infer<typeof selectedFeaturesSchema>;

export const saveDesignSelectionRequestSchema = z
  .object({
    garmentType: garmentTypeIdSchema,
    outfitCategory: outfitCategorySchema,
    /** Only used when the profile's Clothing Preference is "any". */
    department: clothingPreferenceSchema.optional(),
    selectedFeatures: selectedFeaturesSchema,
    customization: z
      .object({
        necklineDepth: z.enum(['shallow', 'medium', 'deep']).optional(),
        sleeveLength: z.enum(['none', 'cap', 'short', 'elbow', 'three_quarter', 'full']).optional(),
        otherSelectedAttributes: z
          .record(z.string().max(40), z.string().max(60))
          .refine((o) => Object.keys(o).length <= DESIGN_LIMITS.otherAttributes)
          .optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type SaveDesignSelectionRequest = z.infer<typeof saveDesignSelectionRequestSchema>;

export const designFeaturesQuerySchema = z.object({
  garmentType: garmentTypeIdSchema,
  /** Only used when the profile's Clothing Preference is "any"; otherwise the profile decides. */
  department: clothingPreferenceSchema.optional(),
  /** `suits`: only what suits the user (the default); `all`: everything, each with its suitability. */
  view: z.enum(['suits', 'all']).default('suits'),
});
export type DesignFeaturesQuery = z.infer<typeof designFeaturesQuerySchema>;

export const designTaxonomyQuerySchema = z.object({ department: clothingPreferenceSchema.optional() });

// --- Responses -------------------------------------------------------------------------------------------

export interface DesignImage {
  assetId: string;
  url: string;
  alt: string;
}

export interface GarmentTypeItem {
  id: string;
  name: string;
  kind: GarmentKind;
  outfitCategories: OutfitCategory[];
  featureCategories: DesignFeatureCategory[];
}

export interface DesignTaxonomyResponse {
  /** The Clothing Preference everything is filtered by; null when the profile says "any" and none was asked. */
  department: ClothingPreference | null;
  /** True when the profile allows both (`any`), so the page may offer the switch. */
  canSwitchDepartment: boolean;
  outfitCategories: Array<{ id: OutfitCategory; label: string; garmentTypes: GarmentTypeItem[] }>;
}

export interface DesignFeatureItem {
  featureId: string;
  name: string;
  description: string;
  category: DesignFeatureCategory;
  image: DesignImage | null;
  /** Transparent layer for the visual customizer, on the same canvas as the department's base figure. */
  layer: DesignImage | null;
  /** Null when no approved rule speaks to this feature for this user. */
  suitability: { result: SuitabilityResult; reasons: string[] } | null;
  preference: FeaturePreference | null;
}

export interface DesignFeatureCategoryResult {
  id: DesignFeatureCategory;
  label: string;
  presentation: FeaturePresentation;
  /** True when approved rules filtered this category; false means every feature is shown unranked. */
  personalised: boolean;
  features: DesignFeatureItem[];
}

export interface DesignSelectionItem {
  garmentType: string;
  outfitCategory: OutfitCategory;
  department: ClothingPreference;
  selectedFeatures: SelectedFeatures;
  customization: SaveDesignSelectionRequest['customization'];
  savedAt: string;
}

export interface DesignFeaturesResponse {
  department: ClothingPreference;
  garmentType: GarmentTypeItem;
  view: 'suits' | 'all';
  /** Which profile signals were used, so the page can ask for missing ones (the height band, never the height). */
  basis: { bodyType: boolean; heightBand: HeightBandUse; stylingGoals: number };
  baseFigure: DesignImage | null;
  categories: DesignFeatureCategoryResult[];
  /** Pairs that cannot be made together, e.g. strapless with long sleeves. */
  incompatible: Array<[string, string]>;
  selection: DesignSelectionItem | null;
}
export type HeightBandUse = z.infer<typeof heightBandSchema> | null;

export interface DesignPreferencesResponse {
  department: ClothingPreference | null;
  featurePreferences: Array<{ featureId: string; featureCategory: string; preference: FeaturePreference }>;
  stylingGoals: string[];
  fitPreferences: string[];
  occasionPreferences: string[];
  updatedAt: string | null;
}
