import { Schema, type SchemaDefinition } from 'mongoose';
import {
  ASSET_RIGHTS_SOURCES,
  BODY_SHAPE_IDS,
  CATALOGUE_DEPARTMENTS,
  CATALOGUE_LEVELS,
  CATALOGUE_STATUSES,
  COLOUR_HARMONIES,
  DEFAULT_FIGURE_CLOTHING,
  GARMENT_ATTRIBUTE_IDS,
  ILLUSTRATION_KINDS,
  ILLUSTRATION_VIEWS,
  PALETTE_MOODS,
  PALETTE_TEMPERATURES,
  REVIEW_STATUSES,
  SEASONAL_TYPES,
  STYLING_GOAL_IDS,
} from '@styleme/contracts';

// Shared styling catalogue (DATABASE.md §4a, D-110 … D-113). SPECIFIED 2026-10-18 — no endpoint, script or
// engine reads these collections yet. They hold one shared copy of every record; users only reference them
// by stable ID (D-116). Nothing here is user-owned, so none of it is in USER_OWNED_COLLECTIONS.

/**
 * Lifecycle shared by every catalogue record (admin panel, D-120). Styling content may be published only
 * after founder approval (D-62): see `requireApprovalToPublish`.
 */
const lifecycleFields = {
  status: { type: String, enum: CATALOGUE_STATUSES, default: 'draft', required: true },
  version: { type: Number, default: 1, required: true },
  // Test fixture marker (issue #52, D-78).
  isFixture: { type: Boolean, default: undefined },
  review: {
    type: new Schema(
      {
        status: { type: String, enum: REVIEW_STATUSES, default: 'draft', required: true },
        approvedBy: { type: Schema.Types.ObjectId, default: null },
        approvedAt: { type: Date, default: null },
      },
      { _id: false },
    ),
    default: () => ({}),
  },
  publishedAt: { type: Date, default: null },
  archivedAt: { type: Date, default: null },
  createdBy: { type: Schema.Types.ObjectId, default: null },
  updatedBy: { type: Schema.Types.ObjectId, default: null },
};

/** Refuses to publish styling content that the founder has not approved (D-62). */
function requireApprovalToPublish(schema: Schema): void {
  schema.pre('validate', function () {
    if (this.get('status') === 'published' && this.get('review.status') !== 'approved') {
      this.invalidate('status', 'Styling content must be founder-approved before it is published (D-62)');
    }
  });
}

const attributeValueSchema = new Schema(
  {
    attributeId: { type: String, enum: GARMENT_ATTRIBUTE_IDS, required: true },
    valueId: { type: String, required: true },
  },
  { _id: false },
);

// --- Hierarchy: department → group → category → subcategory (D-111) -----------------------------------

export const catalogueCategorySchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    level: { type: String, enum: CATALOGUE_LEVELS, required: true },
    department: { type: String, enum: CATALOGUE_DEPARTMENTS, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    /** Keys from the department down to this node, for breadcrumbs and subtree queries. */
    path: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    /** Garment types (vocabulary category IDs, D-97) this node groups. */
    garmentTypes: { type: [String], default: [] },
    wearTypes: { type: [String], default: [] },
    /** Attributes users can explore in this node, e.g. necklines and sleeves for tops. */
    attributeIds: { type: [String], enum: GARMENT_ATTRIBUTE_IDS, default: [] },
    illustrationIds: { type: [String], default: [] },
    ...lifecycleFields,
  },
  { timestamps: true },
);
catalogueCategorySchema.index({ parentId: 1, sortOrder: 1 });
catalogueCategorySchema.index({ department: 1, level: 1, status: 1 });
catalogueCategorySchema.index({ path: 1 });

// Presentation and applicability of one attribute value (e.g. neckline = v_neck). The value itself is a
// vocabulary ID (D-09); this record adds the description, illustrations and where it applies.
export const garmentAttributeSchema = new Schema(
  {
    attributeId: { type: String, enum: GARMENT_ATTRIBUTE_IDS, required: true },
    valueId: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    categoryIds: { type: [Schema.Types.ObjectId], default: [] },
    illustrationIds: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    ...lifecycleFields,
  },
  { timestamps: true },
);
garmentAttributeSchema.index({ attributeId: 1, valueId: 1 }, { unique: true });
garmentAttributeSchema.index({ categoryIds: 1, attributeId: 1, status: 1 });

// --- Clothing styles: one reusable record, linked to many body shapes and goals (D-111, D-112) ----------

export const clothingStyleSchema = new Schema(
  {
    styleId: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    department: { type: String, enum: CATALOGUE_DEPARTMENTS, required: true },
    /** Category or subcategory node it belongs to. */
    categoryId: { type: Schema.Types.ObjectId, required: true },
    /** The attribute this style illustrates, e.g. `{ neckline, v_neck }`. */
    definingAttribute: { type: attributeValueSchema, required: true },
    /** Other structured attributes (length, fit, rise …); category-specific. */
    attributes: { type: [attributeValueSchema], default: [] },
    wearTypes: { type: [String], default: [] },
    occasions: { type: [String], default: [] },
    styles: { type: [String], default: [] },
    stylingGoals: { type: [String], enum: STYLING_GOAL_IDS, default: [] },
    /** Denormalised from the approved suitability rules, for filtering; the rules stay authoritative. */
    bodyShapes: { type: [String], enum: BODY_SHAPE_IDS, default: [] },
    suitabilityRuleIds: { type: [String], default: [] },
    explanation: {
      type: new Schema(
        {
          summary: { type: String, required: true },
          benefits: { type: [String], default: [] },
          tradeOffs: { type: [String], default: [] },
          stylingTips: { type: [String], default: [] },
          fitAndComfort: { type: String, default: null },
          coverage: { type: String, default: null },
        },
        { _id: false },
      ),
      required: true,
    },
    illustrations: {
      type: [
        new Schema(
          {
            illustrationId: { type: String, required: true },
            role: { type: String, enum: ['primary', 'view', 'technical', 'detail'], required: true },
            view: { type: String, enum: ILLUSTRATION_VIEWS, default: 'front' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    relatedStyleIds: { type: [String], default: [] },
    alternativeStyleIds: { type: [String], default: [] },
    /** 2D try-on support (D-119): the layer this style renders on, and the slots it replaces. */
    tryOn: {
      type: new Schema(
        {
          supported: { type: Boolean, default: false },
          layer: { type: String, enum: ['inner', 'top', 'bottom', 'one_piece', 'outer', 'accessory'], default: null },
          replaces: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    tags: { type: [String], default: [] },
    ...lifecycleFields,
  },
  { timestamps: true },
);
requireApprovalToPublish(clothingStyleSchema);
clothingStyleSchema.index({ department: 1, categoryId: 1, status: 1 });
clothingStyleSchema.index({ status: 1, bodyShapes: 1 });
clothingStyleSchema.index({ status: 1, 'definingAttribute.attributeId': 1, 'definingAttribute.valueId': 1 });
clothingStyleSchema.index({ status: 1, publishedAt: -1 });
clothingStyleSchema.index({ name: 'text', description: 'text', tags: 'text' });

// --- Knowledge-base records moved into MongoDB (D-110) -------------------------------------------------

/**
 * Palettes (PAL), outfit templates (OUT), styling and suitability rules (STY) and fabric rules (FAB). The
 * record body is the exact shape validated by `apps/api/src/style-rules/schemas.ts` — one definition, not
 * re-declared here; `facets` copies the few fields that lists and filters query.
 */
function knowledgeRecordSchema<F extends SchemaDefinition>(facets: F) {
  const schema = new Schema(
    {
      recordId: { type: String, required: true, unique: true },
      name: { type: String, required: true },
      record: { type: Schema.Types.Mixed, required: true },
      facets: { type: new Schema(facets, { _id: false }), default: () => ({}) },
      tags: { type: [String], default: [] },
      ...lifecycleFields,
    },
    { timestamps: true, minimize: false },
  );
  requireApprovalToPublish(schema);
  schema.index({ status: 1, publishedAt: -1 });
  return schema;
}

export const paletteSchema = knowledgeRecordSchema({
  temperature: { type: String, enum: PALETTE_TEMPERATURES, default: null },
  colorIds: { type: [String], default: [] },
  colourFamilies: { type: [String], default: [] },
  harmony: { type: String, enum: COLOUR_HARMONIES, default: null },
  seasonal: { type: [String], enum: SEASONAL_TYPES, default: [] },
  moods: { type: [String], enum: PALETTE_MOODS, default: [] },
  undertoneAffinity: { type: [String], default: [] },
  occasions: { type: [String], default: [] },
  styles: { type: [String], default: [] },
  culturalContexts: { type: [String], default: [] },
});
paletteSchema.index({ status: 1, 'facets.undertoneAffinity': 1, 'facets.temperature': 1 });
paletteSchema.index({ status: 1, 'facets.colourFamilies': 1 });
paletteSchema.index({ status: 1, 'facets.occasions': 1 });
paletteSchema.index({ name: 'text', tags: 'text', 'facets.colorIds': 'text' });

export const outfitTemplateSchema = knowledgeRecordSchema({
  department: { type: String, default: null },
  wearType: { type: String, default: null },
  occasions: { type: [String], default: [] },
  styles: { type: [String], default: [] },
  garmentTypes: { type: [String], default: [] },
  clothingStyleIds: { type: [String], default: [] },
});
outfitTemplateSchema.index({ status: 1, 'facets.department': 1, 'facets.occasions': 1 });
outfitTemplateSchema.index({ 'facets.clothingStyleIds': 1 });

export const stylingRuleSchema = knowledgeRecordSchema({
  type: { type: String, default: null },
  bodyShapes: { type: [String], enum: BODY_SHAPE_IDS, default: [] },
  stylingGoals: { type: [String], enum: STYLING_GOAL_IDS, default: [] },
  attributeIds: { type: [String], default: [] },
});
stylingRuleSchema.index({ status: 1, 'facets.type': 1 });
stylingRuleSchema.index({ status: 1, 'facets.bodyShapes': 1 });

export const fabricRuleSchema = knowledgeRecordSchema({ fabric: { type: String, default: null } });

// --- Illustrations and images, with rights (D-113) -------------------------------------------------------

export const illustrationSchema = new Schema(
  {
    assetId: { type: String, required: true, unique: true },
    kind: { type: String, enum: ILLUSTRATION_KINDS, required: true },
    title: { type: String, required: true },
    /** Meaningful alternative text is required for every published asset. */
    altText: { type: String, required: true },
    views: {
      type: [
        new Schema(
          {
            view: { type: String, enum: ILLUSTRATION_VIEWS, required: true },
            /** `static`: path under the web app's public assets; `object_storage`: key (D-107). */
            storage: { type: String, enum: ['static', 'object_storage'], required: true },
            path: { type: String, required: true },
            format: { type: String, enum: ['svg', 'webp', 'png', 'jpeg'], required: true },
            width: { type: Number, default: null },
            height: { type: Number, default: null },
          },
          { _id: false },
        ),
      ],
      validate: [(v: unknown[]) => v.length > 0, 'At least one view'],
    },
    depicts: {
      type: new Schema(
        {
          departments: { type: [String], enum: CATALOGUE_DEPARTMENTS, default: [] },
          clothingStyleIds: { type: [String], default: [] },
          bodyShape: { type: String, enum: BODY_SHAPE_IDS, default: null },
          /** Monk-scale range shown on a figure; representation only, never used for advice. */
          skinToneRange: { type: String, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    /** Every figure is clothed: a plain white shirt and plain white pants by default. */
    figureClothing: { type: String, enum: [DEFAULT_FIGURE_CLOTHING, 'styled_outfit', null], default: null },
    tryOn: {
      type: new Schema(
        {
          layer: { type: String, default: null },
          zIndex: { type: Number, default: null },
          recolourable: { type: Boolean, default: false },
          recolourRegions: { type: [String], default: [] },
          compatibleModelIds: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: undefined,
    },
    rights: {
      type: new Schema(
        {
          source: { type: String, enum: ASSET_RIGHTS_SOURCES, required: true },
          creator: { type: String, required: true },
          licence: { type: String, required: true },
          licenceUrl: { type: String, default: null },
          attribution: { type: String, default: null },
          allowedUsage: { type: [String], default: [] },
          evidenceRef: { type: String, default: null },
          verifiedBy: { type: Schema.Types.ObjectId, default: null },
          verifiedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      required: true,
    },
    ...lifecycleFields,
  },
  { timestamps: true },
);
// Assets without confirmed usage rights are never published (Outfit Categories Q78, D-113).
illustrationSchema.pre('validate', function () {
  if (this.get('status') === 'published' && !this.get('rights.verifiedAt')) {
    this.invalidate('status', 'Usage rights must be verified before an asset is published');
  }
});
illustrationSchema.index({ kind: 1, status: 1 });
illustrationSchema.index({ 'depicts.clothingStyleIds': 1 });

// --- Aggregate usage counters for the admin dashboard (D-125) -----------------------------------------

/** One counter per day, feature and metric. No user ID or other personal data. */
export const usageDailyStatSchema = new Schema({
  day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  feature: { type: String, required: true },
  metric: { type: String, required: true },
  count: { type: Number, default: 0, required: true },
});
usageDailyStatSchema.index({ day: 1, feature: 1, metric: 1 }, { unique: true });
