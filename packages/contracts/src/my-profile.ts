import { z } from 'zod';
import { BODY_SHAPES } from './catalogue';
import { budgetPreferenceSchema } from './profile';
import { categoryGroupSchema, type ClothingPreference, type ProportionDescriptor } from './style-vocabulary';

// My Profile (FRD §4.3a FR-MYP, DATABASE.md §3.2, decisions D-102 … D-105, revised by D-129 on 2026-10-22).
// The profile asks for the Clothing Preference, skin tone and undertone (photo or manual), body type
// (measurements or photo) and optional fit measurements. Colours, fit, contrast, silhouettes, coverage,
// comfort, styles and occasions are not asked here (D-129): they depend on the outfit and are asked by
// Discover My Style and Shop My Look.

// --- Body measurements (D-129): entered by the user, stored in centimetres ---------------------------

export const MEASUREMENT_UNITS = ['cm', 'in'] as const;
export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS);
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>;

export const CM_PER_INCH = 2.54;
const round1 = (n: number) => Math.round(n * 10) / 10;
/** Display conversion, rounded to one decimal place. Values are always stored in centimetres. */
export const cmToInches = (cm: number) => round1(cm / CM_PER_INCH);
export const inchesToCm = (inches: number) => round1(inches * CM_PER_INCH);

/**
 * Every body measurement StyleMe can store. `purpose: body_type` measurements identify the body type;
 * `fit` measurements are optional and only help clothing fit. `departments` limits a measurement to the
 * Clothing Preference it is asked for. `rangeCm` is a plausibility check on input, not a statement about
 * anyone's body. `howTo` is shown with the measuring illustration (DATABASE.md §4a `illustrations`).
 */
export const BODY_MEASUREMENTS = [
  // Body type (required to identify a body type from measurements).
  {
    id: 'shoulder',
    label: 'Shoulder circumference',
    purpose: 'body_type',
    departments: ['women', 'men'],
    rangeCm: [60, 180],
    usedFor: 'Shoulder proportion and breadth',
    howTo: 'Measure around the widest part of your shoulders, keeping the tape level and your arms relaxed.',
  },
  {
    id: 'bust',
    label: 'Bust',
    purpose: 'body_type',
    departments: ['women'],
    rangeCm: [60, 170],
    usedFor: 'Upper-body proportion',
    howTo: 'Measure around the fullest part of your bust, keeping the tape level under your arms.',
  },
  {
    id: 'chest',
    label: 'Chest',
    purpose: 'body_type',
    departments: ['men'],
    rangeCm: [60, 170],
    usedFor: 'Upper-body size',
    howTo: 'Measure around the fullest part of your chest, just under your arms, keeping the tape level.',
  },
  {
    id: 'waist',
    label: 'Waist',
    purpose: 'body_type',
    departments: ['women', 'men'],
    rangeCm: [45, 170],
    usedFor: 'Waist definition and midsection',
    howTo: 'Measure around the narrowest part of your waist, typically just above the belly button.',
  },
  {
    id: 'hip',
    label: 'Hip',
    purpose: 'body_type',
    departments: ['women', 'men'],
    rangeCm: [60, 180],
    usedFor: 'Lower-body proportion',
    howTo: 'Stand with your feet together and measure around the fullest part of your hips and seat.',
  },
  {
    id: 'highHip',
    label: 'High hip',
    purpose: 'body_type',
    departments: ['women'],
    rangeCm: [55, 170],
    usedFor: 'Helps tell Spoon and other hip-dominant shapes apart',
    howTo: 'Measure around your hips about 8–10 cm (3–4 in) below your waist, over the top of the hip bones.',
  },
  // Clothing fit (optional).
  {
    id: 'underbust',
    label: 'Underbust',
    purpose: 'fit',
    departments: ['women'],
    rangeCm: [50, 150],
    usedFor: 'Bra and blouse fitting',
    howTo: 'Measure around your ribcage directly under your bust, keeping the tape snug and level.',
  },
  {
    id: 'neck',
    label: 'Neck circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [25, 60],
    usedFor: 'Collar and neckline fitting',
    howTo: 'Measure around the base of your neck where a collar sits, with one finger under the tape.',
  },
  {
    id: 'shoulderToWaist',
    label: 'Shoulder-to-waist length',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [25, 70],
    usedFor: 'Top, blouse, shirt and jacket length',
    howTo: 'Measure from the highest point of your shoulder, next to the neck, straight down to your natural waist.',
  },
  {
    id: 'backWidth',
    label: 'Back width',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [25, 60],
    usedFor: 'Fit across the upper back',
    howTo: 'Measure across your upper back from one armhole crease to the other, about 15 cm below the neck.',
  },
  {
    id: 'armhole',
    label: 'Armhole circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [25, 70],
    usedFor: 'Sleeve and armhole comfort',
    howTo: 'Measure around the top of your arm, over the shoulder point and under the armpit.',
  },
  {
    id: 'upperArm',
    label: 'Upper-arm circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [15, 60],
    usedFor: 'Sleeve fitting',
    howTo: 'Measure around the fullest part of your upper arm, with the arm relaxed.',
  },
  {
    id: 'wrist',
    label: 'Wrist circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [10, 30],
    usedFor: 'Fitted sleeves and cuffs',
    howTo: 'Measure around your wrist, just over the wrist bone.',
  },
  {
    id: 'sleeveLength',
    label: 'Sleeve length',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [40, 95],
    usedFor: 'Correct sleeve length',
    howTo: 'With your arm slightly bent, measure from the shoulder point down to the wrist bone.',
  },
  {
    id: 'waistToHip',
    label: 'Waist-to-hip length',
    purpose: 'fit',
    departments: ['women'],
    rangeCm: [10, 40],
    usedFor: 'Skirt and trouser proportions',
    howTo: 'Measure down the side of your body from your natural waist to the fullest part of your hip.',
  },
  {
    id: 'thigh',
    label: 'Thigh circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [30, 100],
    usedFor: 'Trouser and jeans fitting',
    howTo: 'Measure around the fullest part of your thigh, just below the crotch.',
  },
  {
    id: 'knee',
    label: 'Knee circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [25, 65],
    usedFor: 'Fitted trousers',
    howTo: 'Measure around your knee with the leg straight.',
  },
  {
    id: 'calf',
    label: 'Calf circumference',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [20, 60],
    usedFor: 'Trousers and boots',
    howTo: 'Measure around the fullest part of your calf.',
  },
  {
    id: 'inseam',
    label: 'Inseam',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [50, 110],
    usedFor: 'Trouser length',
    howTo: 'Measure from the crotch down the inside of your leg to where trousers should end, usually the ankle.',
  },
  {
    id: 'outseam',
    label: 'Outseam',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [70, 130],
    usedFor: 'Full trouser length',
    howTo: 'Measure from your natural waist down the outside of your leg to where trousers should end.',
  },
  {
    id: 'riseFront',
    label: 'Front rise',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [15, 50],
    usedFor: 'Trouser waist and crotch fit (front)',
    howTo: 'Measure from the centre front of your waist down to the crotch point.',
  },
  {
    id: 'riseBack',
    label: 'Back rise',
    purpose: 'fit',
    departments: ['women', 'men'],
    rangeCm: [20, 60],
    usedFor: 'Trouser waist and crotch fit (back)',
    howTo: 'Measure from the centre back of your waist down to the crotch point.',
  },
  {
    id: 'dressLength',
    label: 'Dress length preference',
    purpose: 'fit',
    departments: ['women'],
    rangeCm: [50, 170],
    usedFor: 'Your preferred dress length',
    howTo: 'Measure from the highest point of your shoulder, next to the neck, down to where a dress should end.',
  },
  {
    id: 'jacketLength',
    label: 'Jacket length preference',
    purpose: 'fit',
    departments: ['men'],
    rangeCm: [50, 110],
    usedFor: 'Your preferred jacket length',
    howTo: 'Measure from the base of the back of your neck down to where a jacket should end.',
  },
  {
    id: 'shirtLength',
    label: 'Shirt length preference',
    purpose: 'fit',
    departments: ['men'],
    rangeCm: [50, 110],
    usedFor: 'Your preferred shirt length',
    howTo: 'Measure from the base of the back of your neck down to where a shirt should end.',
  },
] as const satisfies readonly {
  id: string;
  label: string;
  purpose: 'body_type' | 'fit';
  departments: readonly ClothingPreference[];
  rangeCm: readonly [number, number];
  usedFor: string;
  howTo: string;
}[];
export type BodyMeasurementId = (typeof BODY_MEASUREMENTS)[number]['id'];
export type BodyMeasurement = (typeof BODY_MEASUREMENTS)[number];
export const BODY_MEASUREMENT_IDS = BODY_MEASUREMENTS.map((m) => m.id) as [BodyMeasurementId, ...BodyMeasurementId[]];

/** The order each Clothing Preference asks for measurements in (founder lists, D-129). */
export const MEASUREMENT_ORDER = {
  women: {
    body_type: ['shoulder', 'bust', 'waist', 'hip', 'highHip'],
    fit: [
      'underbust',
      'shoulderToWaist',
      'backWidth',
      'armhole',
      'upperArm',
      'wrist',
      'sleeveLength',
      'neck',
      'waistToHip',
      'thigh',
      'knee',
      'calf',
      'inseam',
      'outseam',
      'riseFront',
      'riseBack',
      'dressLength',
    ],
  },
  men: {
    body_type: ['shoulder', 'chest', 'waist', 'hip'],
    fit: [
      'neck',
      'backWidth',
      'shoulderToWaist',
      'armhole',
      'upperArm',
      'wrist',
      'sleeveLength',
      'thigh',
      'knee',
      'calf',
      'inseam',
      'outseam',
      'riseFront',
      'riseBack',
      'jacketLength',
      'shirtLength',
    ],
  },
} as const satisfies Record<ClothingPreference, Record<'body_type' | 'fit', readonly BodyMeasurementId[]>>;

const MEASUREMENT_BY_ID = new Map<string, BodyMeasurement>(BODY_MEASUREMENTS.map((m) => [m.id, m]));
export function bodyMeasurement(id: BodyMeasurementId): BodyMeasurement {
  return MEASUREMENT_BY_ID.get(id)!;
}

/** Measurements for a Clothing Preference and purpose, in the order they are asked. */
export function measurementsFor(department: ClothingPreference, purpose: 'body_type' | 'fit'): BodyMeasurement[] {
  return MEASUREMENT_ORDER[department][purpose].map((id) => bodyMeasurement(id));
}

/**
 * Stable illustration asset ID per measurement and Clothing Preference (seeded into `illustrations`):
 * ILL-1101 … for women and ILL-1201 … for men, in the order the measurements are asked.
 */
export function measurementIllustrationId(department: ClothingPreference, id: BodyMeasurementId): string {
  const order: readonly BodyMeasurementId[] = [
    ...MEASUREMENT_ORDER[department].body_type,
    ...MEASUREMENT_ORDER[department].fit,
  ];
  return `ILL-${(department === 'women' ? 1100 : 1200) + order.indexOf(id) + 1}`;
}

/** Public path of a measurement guide (generated SVG under the web app's `public/`). */
export function measurementIllustrationPath(department: ClothingPreference, id: BodyMeasurementId): string {
  return `/illustrations/profile/measure-${department}-${id}.svg`;
}

/** Public path of an undertone guide (generated SVG under the web app's `public/`). */
export function undertoneIllustrationPath(undertone: keyof typeof UNDERTONE_ILLUSTRATION_IDS): string {
  return `/illustrations/profile/undertone-${undertone}.svg`;
}

/** Undertone guide illustrations (hands): ILL-1301 … in `UNDERTONES` order (warm, cool, neutral, olive). */
export const UNDERTONE_ILLUSTRATION_IDS = {
  warm: 'ILL-1301',
  cool: 'ILL-1302',
  neutral: 'ILL-1303',
  olive: 'ILL-1304',
} as const;

const measurementValues = Object.fromEntries(
  BODY_MEASUREMENTS.map((m) => [m.id, z.number().min(m.rangeCm[0]).max(m.rangeCm[1]).optional()]),
) as Record<BodyMeasurementId, z.ZodOptional<z.ZodNumber>>;
export const measurementValuesSchema = z.object(measurementValues).strict();
export type MeasurementValues = Partial<Record<BodyMeasurementId, number>>;

/** Stored form: values in centimetres plus the unit the user prefers to see. */
export const bodyMeasurementsSchema = z
  .object({ displayUnit: measurementUnitSchema, valuesCm: measurementValuesSchema })
  .strict();
export type BodyMeasurements = z.infer<typeof bodyMeasurementsSchema>;

/**
 * `PUT /v1/measurements` (values in centimetres): the given values are saved, measurements listed in
 * `clear` are removed, and the rest are unchanged. Every measurement must belong to the user's Clothing
 * Preference. Saving body-type measurements identifies the body type at once.
 */
export const updateMeasurementsRequestSchema = z
  .object({
    displayUnit: measurementUnitSchema,
    valuesCm: measurementValuesSchema,
    clear: z.array(z.enum(BODY_MEASUREMENT_IDS)).max(BODY_MEASUREMENTS.length).optional(),
  })
  .strict();
export type UpdateMeasurementsRequest = z.infer<typeof updateMeasurementsRequestSchema>;

/** Converts values typed in `unit` to centimetres (the stored form). */
export function toCentimetres(values: MeasurementValues, unit: MeasurementUnit): MeasurementValues {
  if (unit === 'cm') return { ...values };
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, inchesToCm(v as number)]));
}

/** Body-type measurements still missing for a Clothing Preference, in the order they are asked. */
export function missingBodyTypeMeasurements(
  department: ClothingPreference,
  values: MeasurementValues,
): BodyMeasurementId[] {
  return MEASUREMENT_ORDER[department].body_type.filter((id) => values[id] === undefined);
}

// --- Body types (D-129) --------------------------------------------------------------------------------
// Flexible styling references, never judgements (FR-STY-05). Each maps to a proportion descriptor through
// `BODY_SHAPES`, so recommendations keep using the existing soft signal.

export const BODY_TYPES_BY_DEPARTMENT = {
  women: [
    'hourglass',
    'top_hourglass',
    'bottom_hourglass',
    'pear',
    'spoon',
    'rectangle',
    'inverted_triangle',
    'oval',
    'diamond',
  ],
  men: ['rectangle', 'triangle', 'inverted_triangle', 'trapezoid', 'oval'],
} as const;
export type BodyType =
  (typeof BODY_TYPES_BY_DEPARTMENT)['women'][number] | (typeof BODY_TYPES_BY_DEPARTMENT)['men'][number];
export const BODY_TYPE_IDS = [...new Set([...BODY_TYPES_BY_DEPARTMENT.women, ...BODY_TYPES_BY_DEPARTMENT.men])] as [
  BodyType,
  ...BodyType[],
];
export const bodyTypeSchema = z.enum(BODY_TYPE_IDS);

/** Neutral, descriptive wording shown on the body-type cards and results. */
export const BODY_TYPE_DESCRIPTIONS: Record<BodyType, string> = {
  hourglass: 'Bust and hips are about the same width, with a clearly defined waist.',
  top_hourglass: 'A defined waist, with the bust slightly fuller than the hips.',
  bottom_hourglass: 'A defined waist, with the hips slightly fuller than the bust.',
  pear: 'Hips are wider than the bust and shoulders; the waist is gently defined.',
  spoon: 'Hips are wider than the bust, with fullness that starts high on the hip.',
  rectangle: 'Shoulders, chest or bust, waist and hips are fairly similar in width.',
  inverted_triangle: 'Shoulders and chest or bust are wider than the hips.',
  oval: 'Fuller through the middle, with the waist the widest point.',
  diamond: 'Fuller through the middle, with narrower shoulders and wider hips.',
  triangle: 'Hips are wider than the chest and shoulders.',
  trapezoid: 'Shoulders and chest are a little wider than the waist and hips.',
};

export function bodyTypesFor(department: ClothingPreference): readonly BodyType[] {
  return BODY_TYPES_BY_DEPARTMENT[department];
}

export function bodyTypeLabel(bodyType: BodyType): string {
  return BODY_SHAPES.find((s) => s.id === bodyType)?.label ?? bodyType;
}

/** The proportion descriptor a body type corresponds to (the soft signal used by recommendations). */
export function bodyTypeProportion(bodyType: BodyType): ProportionDescriptor | null {
  return BODY_SHAPES.find((s) => s.id === bodyType)?.proportion ?? null;
}

/**
 * Identifies a body type from body-type measurements (centimetres). Deterministic: the women's rules follow
 * the published FFIT for Apparel thresholds (Simmons, Istook & Devarajan, 2004), extended for Oval and
 * Diamond; the men's rules use the chest-to-waist drop. Thresholds are in inches, as published. Returns
 * null when a required measurement is missing. The user can always correct the result.
 */
export const BODY_TYPE_RULES_VERSION = 'measurements-v1';

export function classifyBodyType(department: ClothingPreference, valuesCm: MeasurementValues): BodyType | null {
  if (missingBodyTypeMeasurements(department, valuesCm).length > 0) return null;
  const inch = (id: BodyMeasurementId) => (valuesCm[id] as number) / CM_PER_INCH;
  const shoulder = inch('shoulder');
  const waist = inch('waist');
  const hip = inch('hip');

  if (department === 'men') {
    const chest = inch('chest');
    if (waist >= chest && waist >= hip) return 'oval';
    if (hip - chest >= 2) return 'triangle';
    if (chest - waist >= 9 || shoulder - hip >= 10) return 'inverted_triangle';
    if (chest - waist >= 4 && chest > hip) return 'trapezoid';
    return 'rectangle';
  }

  const bust = inch('bust');
  const highHip = inch('highHip');
  if (waist >= bust && waist >= hip) return hip > bust ? 'diamond' : 'oval';
  if (bust - hip <= 1 && hip - bust < 3.6 && (bust - waist >= 9 || hip - waist >= 10)) return 'hourglass';
  if (hip - bust >= 3.6 && hip - bust < 10 && hip - waist >= 9 && highHip / waist < 1.193) return 'bottom_hourglass';
  if (bust - hip > 1 && bust - hip < 10 && bust - waist >= 9) return 'top_hourglass';
  if (hip - bust > 2 && hip - waist >= 7 && highHip / waist >= 1.193) return 'spoon';
  if (hip - bust >= 3.6 && hip - waist < 9) return 'pear';
  if ((bust - hip >= 3.6 || shoulder - hip >= 6) && bust - waist < 9) return 'inverted_triangle';
  if (hip - bust > 2) return 'pear';
  if (bust - hip > 2) return 'inverted_triangle';
  return 'rectangle';
}

/** `GET`/`PUT /v1/measurements`. */
export interface MeasurementsResponse {
  displayUnit: MeasurementUnit;
  valuesCm: MeasurementValues;
  updatedAt: string | null;
  /** The body type identified from the saved measurements, or null when some are missing. */
  bodyTypeFromMeasurements: BodyType | null;
}

// --- Age group (D-104): optional; no date of birth is ever collected ---------------------------------
// Defined in `profile.ts` (`AGE_GROUPS`), because `PUT /v1/profile` accepts it.

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

/** My Profile sections (D-129), each edited and saved on its own (FR-MYP-02). */
export const PROFILE_SECTIONS = [
  { id: 'basic_info', label: 'Clothing preference & basics', core: true },
  { id: 'skin_tone', label: 'Skin tone & undertone', core: true },
  { id: 'body_shape', label: 'Body type', core: true },
  { id: 'measurements', label: 'Fit measurements', core: false },
  { id: 'budget', label: 'Budget', core: false },
] as const;
export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]['id'];
export const profileSectionSchema = z.enum(
  PROFILE_SECTIONS.map((s) => s.id) as [ProfileSectionId, ...ProfileSectionId[]],
);

/** "Reset preferences": basic information is never reset; photos and measurements only if chosen. */
export const RESETTABLE_SECTIONS = ['budget', 'skin_tone', 'body_shape', 'measurements'] as const;
export const resetPreferencesRequestSchema = z
  .object({ sections: z.array(z.enum(RESETTABLE_SECTIONS)).min(1), confirm: z.literal(true) })
  .strict();

// --- Data export (D-105) ---------------------------------------------------------------------------

export const EXPORT_FORMATS = ['json', 'pdf'] as const;
export const exportFormatSchema = z.enum(EXPORT_FORMATS);
