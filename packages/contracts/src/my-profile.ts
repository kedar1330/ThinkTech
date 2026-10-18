import { z } from 'zod';
import { budgetPreferenceSchema } from './profile';
import { categoryGroupSchema, proportionDescriptorSchema } from './style-vocabulary';

// My Profile extensions (FRD §4.3a FR-MYP, DATABASE.md §3.2, decision D-102 … D-105).
// Approved by the founder on 2026-10-18, not built yet. Nothing here is accepted by any endpoint yet:
// `PUT /v1/profile` (`updateProfileRequestSchema`) still rejects age, measurements and the other fields
// below until the section-based profile API (TODO TD-MYP-04) is built. The age group ships only after
// the D-74 legal review.

// --- Age group (D-104): optional; no date of birth is ever collected ---------------------------------

export const AGE_GROUPS = [
  { id: 'under_18', label: 'Under 18' },
  { id: '18_24', label: '18–24' },
  { id: '25_34', label: '25–34' },
  { id: '35_44', label: '35–44' },
  { id: '45_plus', label: '45+' },
] as const;
export const AGE_GROUP_IDS = AGE_GROUPS.map((a) => a.id) as [
  (typeof AGE_GROUPS)[number]['id'],
  ...(typeof AGE_GROUPS)[number]['id'][],
];
export const ageGroupSchema = z.enum(AGE_GROUP_IDS);
export type AgeGroup = z.infer<typeof ageGroupSchema>;

// --- Body measurements (D-102): manual entry only; stored in centimetres -----------------------------

export const MEASUREMENT_UNITS = ['cm', 'in'] as const;
export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS);
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;

export const CM_PER_INCH = 2.54;
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Display conversion, rounded to one decimal place. Values are always stored in centimetres. */
export const cmToInches = (cm: number) => round1(cm / CM_PER_INCH);
export const inchesToCm = (inches: number) => round1(inches * CM_PER_INCH);

/**
 * Body measurements (not garment measurements). `tier: essential` is shown first and is needed for
 * fit-based recommendations; `detailed` sits in an expandable section. `departments` limits a field to
 * the clothing preference it is relevant for. `rangeCm` is the accepted input range — a plausibility
 * check proposed for review, not a statement about anyone's body.
 */
export const BODY_MEASUREMENTS = [
  {
    id: 'height',
    label: 'Height',
    tier: 'essential',
    departments: ['women', 'men'],
    rangeCm: [100, 230],
    purpose: 'Overall proportions and clothing length',
  },
  {
    id: 'shoulderWidth',
    label: 'Shoulder width',
    tier: 'essential',
    departments: ['women', 'men'],
    rangeCm: [25, 70],
    purpose: 'Shoulder structure and proportions',
  },
  {
    id: 'chestBust',
    label: 'Chest / bust',
    tier: 'essential',
    departments: ['women', 'men'],
    rangeCm: [60, 170],
    purpose: 'Upper-body size',
  },
  {
    id: 'waist',
    label: 'Waist',
    tier: 'essential',
    departments: ['women', 'men'],
    rangeCm: [45, 170],
    purpose: 'Waist definition',
  },
  {
    id: 'hipsSeat',
    label: 'Hips / seat',
    tier: 'essential',
    departments: ['women', 'men'],
    rangeCm: [60, 180],
    purpose: 'Lower-body proportions',
  },
  {
    id: 'highHip',
    label: 'High hip',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [55, 170],
    purpose: 'Refines the body-shape estimate',
  },
  {
    id: 'neck',
    label: 'Neck',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [25, 60],
    purpose: 'Shirt and collar fit',
  },
  {
    id: 'armLength',
    label: 'Arm length',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [40, 90],
    purpose: 'Sleeve length',
  },
  {
    id: 'upperArm',
    label: 'Upper arm',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [15, 60],
    purpose: 'Sleeve comfort',
  },
  {
    id: 'wrist',
    label: 'Wrist',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [10, 30],
    purpose: 'Cuff fit',
  },
  {
    id: 'inseam',
    label: 'Inseam',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [50, 110],
    purpose: 'Trouser length',
  },
  {
    id: 'outseam',
    label: 'Outseam',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [70, 130],
    purpose: 'Overall trouser length',
  },
  {
    id: 'thigh',
    label: 'Thigh',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [30, 100],
    purpose: 'Trouser comfort',
  },
  {
    id: 'knee',
    label: 'Knee',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [25, 65],
    purpose: 'Trouser shape and fit',
  },
  {
    id: 'calf',
    label: 'Calf',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [20, 60],
    purpose: 'Trouser shape and fit',
  },
  {
    id: 'torsoLength',
    label: 'Torso length',
    tier: 'detailed',
    departments: ['women', 'men'],
    rangeCm: [30, 80],
    purpose: 'Top and garment proportions',
  },
  {
    id: 'underbust',
    label: 'Underbust',
    tier: 'detailed',
    departments: ['women'],
    rangeCm: [55, 150],
    purpose: 'Innerwear fitting, where applicable',
  },
] as const;
export type BodyMeasurementId = (typeof BODY_MEASUREMENTS)[number]['id'];
export const ESSENTIAL_MEASUREMENT_IDS = BODY_MEASUREMENTS.filter((m) => m.tier === 'essential').map((m) => m.id);

const measurementValues = Object.fromEntries(
  BODY_MEASUREMENTS.map((m) => [m.id, z.number().min(m.rangeCm[0]).max(m.rangeCm[1]).optional()]),
) as Record<BodyMeasurementId, z.ZodOptional<z.ZodNumber>>;

/** Stored form: values in centimetres plus the unit the user prefers to see. */
export const bodyMeasurementsSchema = z
  .object({ displayUnit: measurementUnitSchema, valuesCm: z.object(measurementValues).strict() })
  .strict();
export type BodyMeasurements = z.infer<typeof bodyMeasurementsSchema>;

/** Converts values typed in `unit` to centimetres (the stored form). */
export function toCentimetres(
  values: Partial<Record<BodyMeasurementId, number>>,
  unit: MeasurementUnit,
): Partial<Record<BodyMeasurementId, number>> {
  if (unit === 'cm') return { ...values };
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, inchesToCm(v as number)]));
}

/** Essential measurements still missing, in display order (fit-based features need all of them). */
export function missingEssentialMeasurements(values: Partial<Record<BodyMeasurementId, number>>): BodyMeasurementId[] {
  return ESSENTIAL_MEASUREMENT_IDS.filter((id) => values[id] === undefined);
}

// --- Body shape: manual choice (D-102). Reuses the self-described proportions, plus "Not sure". -------
// Display names and illustrations for the cards need founder approval (D-62); illustrations always show
// a model in a plain white shirt and plain white pants (D-103).

export const bodyShapeChoiceSchema = z.union([proportionDescriptorSchema, z.literal('not_sure')]);
export type BodyShapeChoice = z.infer<typeof bodyShapeChoiceSchema>;

// --- Budgets, custom occasions ---------------------------------------------------------------------

/** Per-category budgets in whole rupees, keyed by size group; the default stays `budgetPreference`. */
export const categoryBudgetsSchema = z.partialRecord(categoryGroupSchema, budgetPreferenceSchema);
export type CategoryBudgets = z.infer<typeof categoryBudgetsSchema>;

/** Free-text occasions are labels for the user only; the engine never reads them (no rules apply). */
export const customOccasionsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[^<>/\\:@]+$/, 'Use plain words only'),
  )
  .max(10);

// --- Sections, completion and reset ---------------------------------------------------------------

/**
 * My Profile sections, each edited and saved on its own (FR-MYP-02). `core` sections drive the
 * completion percentage first; optional sections still add to it but are labelled
 * "Optional — improves personalization" and are never required for 100 % of the core.
 */
export const PROFILE_SECTIONS = [
  { id: 'basic_info', label: 'Basic information', core: true },
  { id: 'skin_tone', label: 'Skin tone & undertone', core: false },
  { id: 'body_shape', label: 'Body shape', core: false },
  { id: 'measurements', label: 'Body measurements', core: false },
  { id: 'style_fit', label: 'Style & fit preferences', core: true },
  { id: 'colours', label: 'Colour preferences', core: true },
  { id: 'occasions', label: 'Occasions', core: true },
  { id: 'budget', label: 'Budget', core: true },
] as const;
export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]['id'];
export const profileSectionSchema = z.enum(
  PROFILE_SECTIONS.map((s) => s.id) as [ProfileSectionId, ...ProfileSectionId[]],
);

/** "Reset preferences": basic information is never reset; photos and measurements only if chosen. */
export const RESETTABLE_SECTIONS = ['style_fit', 'colours', 'occasions', 'budget', 'skin_tone', 'body_shape'] as const;
export const resetPreferencesRequestSchema = z
  .object({ sections: z.array(z.enum(RESETTABLE_SECTIONS)).min(1), confirm: z.literal(true) })
  .strict();

// --- Data export (D-105) ---------------------------------------------------------------------------

export const EXPORT_FORMATS = ['json', 'pdf'] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
