import { z } from 'zod';
import {
  CATEGORY_IDS,
  COLOR_FAMILY_IDS,
  COLOR_IDS,
  CONTRAST_LEVEL_IDS,
  FABRIC_IDS,
  FIT_IDS,
  GARMENT_LENGTH_IDS,
  NECKLINE_DEPTH_IDS,
  NECKLINE_IDS,
  PATTERN_IDS,
  PATTERN_SCALE_IDS,
  SILHOUETTE_IDS,
  SLEEVE_LENGTH_IDS,
  SLOT_TYPE_IDS,
  categorySchema,
  colorIdSchema,
  contrastLevelSchema,
  departmentSchema,
  fabricSchema,
  fitSchema,
  garmentLengthSchema,
  heightBandSchema,
  monkRangeSchema,
  necklineSchema,
  occasionSchema,
  patternSchema,
  proportionDescriptorSchema,
  silhouetteSchema,
  sleeveLengthSchema,
  slotTypeSchema,
  styleSchema,
  undertoneAffinitySchema,
} from '@styleme/contracts';

// Record schemas for the style knowledge base (AI.md §4, DATABASE.md §6, FR-STY-01).
// All allowed values come from the shared vocabulary in @styleme/contracts (D-09).

export const REVIEW_STATUSES = ['draft', 'reviewed', 'approved', 'retired'] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

// Profile preferences a user can change that adjust how a record applies (FR-PROF-02).
export const USER_ADJUSTABLE = [
  'colors',
  'contrast',
  'silhouettes',
  'coverage',
  'comfort',
  'fabrics',
  'styles',
  'occasions',
  'fit',
  'signals',
] as const;
export const userAdjustableSchema = z.enum(USER_ADJUSTABLE);

// FR-STY-09 coverage areas, and the coordination aspects within "coordination".
export const RULE_AREAS = ['coordination', 'occasion', 'preference', 'fit', 'size', 'budget', 'alternatives'] as const;
export const ruleAreaSchema = z.enum(RULE_AREAS);
export type RuleArea = z.infer<typeof ruleAreaSchema>;

export const COORDINATION_ASPECTS = [
  'colour',
  'formality',
  'pattern_mixing',
  'proportion_balance',
  'footwear_accessory',
] as const;
export const coordinationAspectSchema = z.enum(COORDINATION_ASPECTS);
export type CoordinationAspect = z.infer<typeof coordinationAspectSchema>;

const nonEmptyText = z.string().trim().min(10).max(1000);
const tag = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'tags are lower-case kebab-case');
const isoDate = z.iso.date();

const commonFields = {
  version: z.number().int().min(1),
  tags: z.array(tag).max(20).default([]),
  userAdjustable: z.array(userAdjustableSchema).default([]),
  rationale: nonEmptyText,
  limitations: nonEmptyText,
  reviewStatus: reviewStatusSchema,
  reviewedBy: z.string().trim().min(1).max(100).nullable().default(null),
  reviewedAt: isoDate.nullable().default(null),
  // Synthetic test records only (CONTRIBUTING.md §5). Never present in the shipped library.
  isFixture: z.literal(true).optional(),
};

// An approved record must say who approved it and when (CONTRIBUTING.md §6, step 3).
function requireReviewer(record: { reviewStatus: ReviewStatus; reviewedBy: string | null; reviewedAt: string | null }) {
  return record.reviewStatus !== 'approved' || (record.reviewedBy !== null && record.reviewedAt !== null);
}
const reviewerMessage = { message: 'approved records need reviewedBy and reviewedAt', path: ['reviewedBy'] };

// --- Attribute references used by rule effects ----------------------------------------------------

// Each attribute a rule can prefer or deprioritise, with the vocabulary its value must come from.
export const ATTRIBUTE_VALUES = {
  category: CATEGORY_IDS,
  color: COLOR_IDS,
  colorFamily: COLOR_FAMILY_IDS,
  contrast: CONTRAST_LEVEL_IDS,
  fabric: FABRIC_IDS,
  fit: FIT_IDS,
  length: GARMENT_LENGTH_IDS,
  neckline: NECKLINE_IDS,
  necklineDepth: NECKLINE_DEPTH_IDS,
  pattern: PATTERN_IDS,
  patternScale: PATTERN_SCALE_IDS,
  silhouette: SILHOUETTE_IDS,
  sleeve: SLEEVE_LENGTH_IDS,
  slotType: SLOT_TYPE_IDS,
} as const satisfies Record<string, readonly string[]>;
export type Attribute = keyof typeof ATTRIBUTE_VALUES;
const ATTRIBUTES = Object.keys(ATTRIBUTE_VALUES) as [Attribute, ...Attribute[]];

export const attributeRefSchema = z
  .object({ attribute: z.enum(ATTRIBUTES), value: z.string() })
  .refine((ref) => (ATTRIBUTE_VALUES[ref.attribute] as readonly string[]).includes(ref.value), {
    message: 'value is not in the vocabulary for this attribute',
    path: ['value'],
  });
export type AttributeRef = z.infer<typeof attributeRefSchema>;

// Soft effects only (FR-STY-04): rules prefer or deprioritise, never forbid.
export const effectSchema = z
  .object({
    prefer: z.array(attributeRefSchema).default([]),
    deprioritise: z.array(attributeRefSchema).default([]),
    weight: z.number().gt(0).lte(1),
  })
  .refine((effect) => effect.prefer.length + effect.deprioritise.length > 0, {
    message: 'an effect needs at least one prefer or deprioritise entry',
  });
export type Effect = z.infer<typeof effectSchema>;

// Where a rule applies. An omitted or empty list means "any".
export const appliesToSchema = z
  .object({
    categories: z.array(categorySchema).default([]),
    occasions: z.array(occasionSchema).default([]),
    styles: z.array(styleSchema).default([]),
    departments: z.array(departmentSchema).default([]),
    proportions: z.array(proportionDescriptorSchema).default([]),
    // Height bands (D-131), derived from the profile's height.
    heights: z.array(heightBandSchema).default([]),
  })
  .default({ categories: [], occasions: [], styles: [], departments: [], proportions: [], heights: [] });
export type AppliesTo = z.infer<typeof appliesToSchema>;

// --- Palettes PAL-xxx --------------------------------------------------------------------------

export const paletteIdSchema = z.string().regex(/^PAL-\d{3,}$/);

export const paletteSchema = z
  .object({
    id: paletteIdSchema,
    ...commonFields,
    name: z.string().trim().min(1).max(80),
    undertoneAffinity: z.array(undertoneAffinitySchema).min(1),
    skinToneRange: monkRangeSchema.optional(),
    neutrals: z.array(colorIdSchema).min(1),
    accents: z.array(colorIdSchema).default([]),
    combinations: z
      .array(z.object({ colors: z.array(colorIdSchema).min(2).max(4), contrastLevel: contrastLevelSchema }))
      .min(1),
    prints: z.array(patternSchema).default([]),
    occasions: z.array(occasionSchema).min(1),
  })
  .strict()
  .refine(requireReviewer, reviewerMessage);
export type Palette = z.infer<typeof paletteSchema>;

// --- Styling / fit rules STY-xxx -----------------------------------------------------------------

export const STYLING_RULE_TYPES = [
  'silhouette',
  'fit',
  'neckline',
  'sleeve',
  'length',
  'layering',
  'proportion',
  'print-scale',
  'combination',
  'coordination',
  'occasion',
  'preference',
  'size',
  'budget',
  'alternatives',
] as const;

export const stylingRuleIdSchema = z.string().regex(/^STY-\d{3,}$/);
export const fabricRuleIdSchema = z.string().regex(/^FAB-\d{3,}$/);
const ruleIdSchema = z.union([stylingRuleIdSchema, fabricRuleIdSchema]);

export const stylingRuleSchema = z
  .object({
    id: stylingRuleIdSchema,
    ...commonFields,
    type: z.enum(STYLING_RULE_TYPES),
    areas: z.array(ruleAreaSchema).min(1),
    coordinationAspects: z.array(coordinationAspectSchema).default([]),
    appliesTo: appliesToSchema,
    effect: effectSchema,
    conflictsWith: z.array(ruleIdSchema).default([]),
  })
  .strict()
  .refine(requireReviewer, reviewerMessage)
  .refine((rule) => rule.coordinationAspects.length === 0 || rule.areas.includes('coordination'), {
    message: 'coordinationAspects need the "coordination" area',
    path: ['coordinationAspects'],
  });
export type StylingRule = z.infer<typeof stylingRuleSchema>;

// --- Fabric rules FAB-xxx ------------------------------------------------------------------------

const level = z.enum(['low', 'medium', 'high']);

export const fabricRuleSchema = z
  .object({
    id: fabricRuleIdSchema,
    ...commonFields,
    fabric: fabricSchema,
    properties: z
      .object({
        breathability: level,
        moistureManagement: level,
        quickDry: z.boolean(),
        warmth: level,
        weight: z.enum(['light', 'medium', 'heavy']),
        stretch: z.enum(['none', 'some', 'high']),
        wrinkleResistance: level,
        care: z.enum(['easy', 'moderate', 'delicate']),
      })
      .strict(),
    useCases: z.array(z.string().trim().min(1).max(100)).min(1),
    // Stage 2 (FR-WX); accepted but unused in Stage 1.
    weatherBands: z.array(z.string().trim().min(1)).default([]),
    areas: z.array(ruleAreaSchema).min(1),
    appliesTo: appliesToSchema,
    effect: effectSchema,
    conflictsWith: z.array(ruleIdSchema).default([]),
    practicalityValidated: z.boolean(),
  })
  .strict()
  .refine(requireReviewer, reviewerMessage);
export type FabricRule = z.infer<typeof fabricRuleSchema>;

// --- Outfit templates OUT-xxx --------------------------------------------------------------------

export const templateIdSchema = z.string().regex(/^OUT-\d{3,}$/);

// Template-defined, stable slot identity (D-82): e.g. "top", "accessory-1".
export const slotIdSchema = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'slotId is lower-case kebab-case');

export const templateSlotSchema = z
  .object({
    slotId: slotIdSchema,
    slot: slotTypeSchema,
    categoryOptions: z.array(categorySchema).min(1),
    optional: z.boolean().default(false),
    // Which palette colours the slot draws from.
    colorRole: z.enum(['neutral', 'accent', 'any']).default('any'),
    constraints: z
      .object({
        silhouettes: z.array(silhouetteSchema).optional(),
        fits: z.array(fitSchema).optional(),
        necklines: z.array(necklineSchema).optional(),
        sleeves: z.array(sleeveLengthSchema).optional(),
        lengths: z.array(garmentLengthSchema).optional(),
        patterns: z.array(patternSchema).optional(),
        fabrics: z.array(fabricSchema).optional(),
      })
      .strict()
      .default({}),
  })
  .strict();
export type TemplateSlot = z.infer<typeof templateSlotSchema>;

export const templateSchema = z
  .object({
    id: templateIdSchema,
    ...commonFields,
    name: z.string().trim().min(1).max(80),
    department: departmentSchema,
    occasions: z.array(occasionSchema).min(1),
    styles: z.array(styleSchema).min(1),
    slots: z.array(templateSlotSchema).min(2).max(8),
    // Empty means any palette that suits the occasion.
    compatiblePalettes: z.array(paletteIdSchema).default([]),
    ruleRefs: z.array(ruleIdSchema).default([]),
  })
  .strict()
  .refine(requireReviewer, reviewerMessage);
export type Template = z.infer<typeof templateSchema>;

export type RecordType = 'palette' | 'stylingRule' | 'fabricRule' | 'template';
export type StyleRecord = Palette | StylingRule | FabricRule | Template;

export const RECORD_SCHEMAS = {
  palette: paletteSchema,
  stylingRule: stylingRuleSchema,
  fabricRule: fabricRuleSchema,
  template: templateSchema,
} as const;

// Raw, unvalidated records as read from the data files or a fixture library.
export interface RawLibrary {
  palettes: unknown[];
  stylingRules: unknown[];
  fabricRules: unknown[];
  templates: unknown[];
}
