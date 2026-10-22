import { Schema } from 'mongoose';
import {
  CATALOGUE_DEPARTMENTS,
  CATALOGUE_STATUSES,
  DESIGN_FEATURE_CATEGORY_IDS,
  FEATURE_PREFERENCES,
  FEATURE_PRESENTATIONS,
  GARMENT_KINDS,
  HEIGHT_BAND_IDS,
  BODY_SHAPE_IDS,
  REVIEW_STATUSES,
  RULE_CONFIDENCES,
  STYLING_GOAL_IDS,
  SUITABILITY_RESULTS,
  WEAR_TYPE_IDS,
} from '@styleme/contracts';

// Design features (D-132, DATABASE.md §4c): the shared catalogue Clothing Preference → outfit category →
// garment type → design feature category → feature, the suitability rules that pick what suits a user, and
// the user's own design preferences and saved selections. The catalogue is shared (not user-owned); the two
// user collections are keyed by `userId` and listed in USER_OWNED_COLLECTIONS.

const fixtureField = { isFixture: { type: Boolean, default: undefined } } as const;

const managed = {
  status: { type: String, enum: CATALOGUE_STATUSES, default: 'published', required: true },
  version: { type: Number, default: 1, required: true },
  ...fixtureField,
};

// --- Shared catalogue ------------------------------------------------------------------------------------

/**
 * The hierarchy above the features: department (women / men) → outfit category (the wear types) → garment
 * type. One node per key; a garment type lists every department and outfit category it belongs to.
 */
export const outfitCategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    level: { type: String, enum: ['department', 'outfit_category', 'garment_type'], required: true },
    name: { type: String, required: true },
    departments: { type: [String], enum: CATALOGUE_DEPARTMENTS, default: [] },
    outfitCategories: { type: [String], enum: WEAR_TYPE_IDS, default: [] },
    /** Garment types only. */
    garmentKind: { type: String, enum: [...GARMENT_KINDS, null], default: null },
    featureCategoryIds: { type: [String], enum: DESIGN_FEATURE_CATEGORY_IDS, default: [] },
    sortOrder: { type: Number, default: 0 },
    ...managed,
  },
  { timestamps: true },
);
outfitCategorySchema.index({ level: 1, departments: 1, status: 1, sortOrder: 1 });

export const designFeatureCategorySchema = new Schema(
  {
    categoryId: { type: String, enum: DESIGN_FEATURE_CATEGORY_IDS, required: true, unique: true },
    label: { type: String, required: true },
    presentation: { type: String, enum: FEATURE_PRESENTATIONS, required: true },
    garmentKinds: { type: [String], enum: GARMENT_KINDS, default: [] },
    sortOrder: { type: Number, default: 0 },
    ...managed,
  },
  { timestamps: true },
);

/** One reusable record per feature, shared by Women's and Men's Wear where the feature is the same. */
export const designFeatureSchema = new Schema(
  {
    featureId: { type: String, required: true, unique: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    featureCategory: { type: String, enum: DESIGN_FEATURE_CATEGORY_IDS, required: true },
    departments: { type: [String], enum: CATALOGUE_DEPARTMENTS, required: true },
    /** Garment kinds it can appear on; empty means every kind its category applies to. */
    garmentKinds: { type: [String], enum: GARMENT_KINDS, default: [] },
    attributes: { type: Schema.Types.Mixed, default: undefined },
    /** Per department, so a V-neck shows on the women's or men's figure (`illustrations.assetId`). */
    illustrations: {
      type: [
        new Schema(
          {
            department: { type: String, enum: CATALOGUE_DEPARTMENTS, required: true },
            role: { type: String, enum: ['card', 'layer'], required: true },
            assetId: { type: String, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    tags: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    selectable: { type: Boolean, default: true },
    ...managed,
  },
  { timestamps: true },
);
designFeatureSchema.index({ featureCategory: 1, departments: 1, status: 1, sortOrder: 1 });

/**
 * When a feature is a good, alternative or less preferred option, and why. Styling content: a rule is used
 * only once it is `active` and founder-approved (D-62); drafts live in `style-rules-drafts/`.
 */
export const featureSuitabilityRuleSchema = new Schema(
  {
    ruleId: { type: String, required: true, unique: true },
    featureId: { type: String, required: true },
    featureCategory: { type: String, enum: DESIGN_FEATURE_CATEGORY_IDS, required: true },
    departments: { type: [String], enum: CATALOGUE_DEPARTMENTS, default: [] },
    /** Garment kinds; empty = any. */
    applicableGarments: { type: [String], enum: GARMENT_KINDS, default: [] },
    /** Every non-empty list must match the user; an empty list means "any". */
    conditions: {
      type: new Schema(
        {
          bodyTypes: { type: [String], enum: BODY_SHAPE_IDS, default: [] },
          heightBands: { type: [String], enum: HEIGHT_BAND_IDS, default: [] },
          stylingGoals: { type: [String], enum: STYLING_GOAL_IDS, default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    recommendation: {
      type: new Schema(
        {
          result: { type: String, enum: SUITABILITY_RESULTS, required: true },
          reason: { type: String, required: true },
          confidence: { type: String, enum: RULE_CONFIDENCES, default: 'rule_based' },
        },
        { _id: false },
      ),
      required: true,
    },
    /** Lower comes first when rules disagree. */
    priority: { type: Number, default: 5 },
    status: { type: String, enum: ['active', 'inactive'], default: 'inactive', required: true },
    reviewStatus: { type: String, enum: REVIEW_STATUSES, default: 'draft', required: true },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    version: { type: Number, default: 1, required: true },
    ...fixtureField,
  },
  { timestamps: true },
);
featureSuitabilityRuleSchema.pre('validate', function () {
  if (this.get('status') === 'active' && this.get('reviewStatus') !== 'approved') {
    this.invalidate('status', 'A suitability rule must be founder-approved before it is active (D-62)');
  }
});
featureSuitabilityRuleSchema.index({ status: 1, reviewStatus: 1, departments: 1, featureCategory: 1 });

/** Feature pairs: `incompatible` cannot be made together; `curated` is a suggested pairing. */
export const featureCombinationSchema = new Schema(
  {
    /** The two feature IDs, sorted and joined with `+`; unique per kind. */
    pairKey: { type: String, required: true },
    featureIds: { type: [String], required: true, validate: [(v: string[]) => v.length === 2, 'A pair'] },
    kind: { type: String, enum: ['incompatible', 'curated'], required: true },
    reason: { type: String, required: true },
    ...managed,
  },
  { timestamps: true },
);
featureCombinationSchema.index({ pairKey: 1, kind: 1 }, { unique: true });
featureCombinationSchema.index({ featureIds: 1, kind: 1 });

// --- User-owned ------------------------------------------------------------------------------------------

/**
 * Likes, dislikes and goals, plus the personalised result last computed for each garment type viewed. The
 * snapshot keeps rule and feature IDs only: body type and height stay in the profile, and `basisKey` (a hash
 * of the inputs) tells when it must be recomputed.
 */
export const userDesignPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    ...fixtureField,
    clothingPreference: { type: String, enum: [...CATALOGUE_DEPARTMENTS, null], default: null },
    featurePreferences: {
      type: [
        new Schema(
          {
            featureId: { type: String, required: true },
            featureCategory: { type: String, enum: DESIGN_FEATURE_CATEGORY_IDS, required: true },
            preference: { type: String, enum: FEATURE_PREFERENCES, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    stylingGoals: { type: [String], enum: STYLING_GOAL_IDS, default: [] },
    fitPreferences: { type: [String], default: [] },
    occasionPreferences: { type: [String], default: [] },
    personalised: {
      type: [
        new Schema(
          {
            garmentType: { type: String, required: true },
            department: { type: String, enum: CATALOGUE_DEPARTMENTS, required: true },
            basisKey: { type: String, required: true },
            computedAt: { type: Date, required: true },
            features: {
              type: [
                new Schema(
                  {
                    featureId: { type: String, required: true },
                    featureCategory: { type: String, required: true },
                    result: { type: String, enum: SUITABILITY_RESULTS, required: true },
                    ruleIds: { type: [String], default: [] },
                  },
                  { _id: false },
                ),
              ],
              default: [],
            },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { timestamps: true },
);

/** The visual customizer's saved choice: one per user and garment type, rebuilt from the catalogue by ID. */
export const userDesignSelectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    ...fixtureField,
    clothingPreference: { type: String, enum: CATALOGUE_DEPARTMENTS, required: true },
    outfitCategory: { type: String, enum: WEAR_TYPE_IDS, required: true },
    garmentType: { type: String, required: true },
    /** Category → feature ID, e.g. `{ neckline: 'neckline_square', sleeve: 'sleeve_full_length' }`. */
    selectedFeatures: { type: Schema.Types.Mixed, default: () => ({}) },
    customization: {
      type: new Schema(
        {
          necklineDepth: { type: String, default: undefined },
          sleeveLength: { type: String, default: undefined },
          otherSelectedAttributes: { type: Schema.Types.Mixed, default: undefined },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    savedAt: { type: Date, required: true },
  },
  { timestamps: true, minimize: false },
);
userDesignSelectionSchema.index({ userId: 1, clothingPreference: 1, garmentType: 1 }, { unique: true });
