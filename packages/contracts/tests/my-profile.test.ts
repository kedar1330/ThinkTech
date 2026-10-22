import { describe, expect, it } from 'vitest';
import {
  AGE_GROUP_IDS,
  BODY_MEASUREMENTS,
  BODY_SHAPES,
  BODY_TYPES_BY_DEPARTMENT,
  BODY_TYPE_DESCRIPTIONS,
  BODY_TYPE_IDS,
  MEASUREMENT_ORDER,
  bodyAnalysisResultSchema,
  bodyMeasurementsSchema,
  bodyTypeProportion,
  categoryBudgetsSchema,
  classifyBodyType,
  cmToInches,
  customOccasionsSchema,
  faceAnalysisResultSchema,
  inchesToCm,
  measurementIllustrationId,
  missingBodyTypeMeasurements,
  photoConsentRequestSchema,
  resetPreferencesRequestSchema,
  toCentimetres,
  updateAppearanceRequestSchema,
  updateProfileRequestSchema,
  uploadPhotoQuerySchema,
  userPhotoSchema,
  PHOTO_NOTICE_VERSION,
  type MeasurementValues,
} from '../src';

// My Profile contracts (D-102 … D-105, revised by D-129 on 2026-10-22).

const inches = (values: Record<string, number>): MeasurementValues =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v * 2.54]));

describe('My Profile contracts (D-129)', () => {
  it('offers only Women’s Wear and Men’s Wear as the Clothing Preference, plus an optional age group', () => {
    expect(updateProfileRequestSchema.safeParse({ department: 'women', ageGroup: '18_24' }).success).toBe(true);
    expect(updateProfileRequestSchema.safeParse({ department: 'men' }).success).toBe(true);
    expect(updateProfileRequestSchema.safeParse({ department: 'any' }).success).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({ department: 'women', measurements: { valuesCm: { waist: 70 } } }).success,
    ).toBe(false);
  });

  it('offers age groups only, never a date of birth', () => {
    expect(AGE_GROUP_IDS).toEqual(['under_18', '18_24', '25_34', '35_44', '45_plus']);
  });

  it('asks the founder’s body-type measurements for each Clothing Preference', () => {
    expect(MEASUREMENT_ORDER.women.body_type).toEqual(['shoulder', 'bust', 'waist', 'hip', 'highHip']);
    expect(MEASUREMENT_ORDER.men.body_type).toEqual(['shoulder', 'chest', 'waist', 'hip']);
    expect(new Set(BODY_MEASUREMENTS.map((m) => m.id)).size).toBe(BODY_MEASUREMENTS.length);
  });

  it('lists every measurement only for the Clothing Preferences it belongs to, with how-to text', () => {
    for (const department of ['women', 'men'] as const) {
      for (const id of [...MEASUREMENT_ORDER[department].body_type, ...MEASUREMENT_ORDER[department].fit]) {
        const m = BODY_MEASUREMENTS.find((x) => x.id === id)!;
        expect(m.departments as readonly string[]).toContain(department);
        expect(m.howTo.length).toBeGreaterThan(10);
      }
    }
    expect(MEASUREMENT_ORDER.women.fit).toHaveLength(17);
    expect(MEASUREMENT_ORDER.men.fit).toHaveLength(16);
    expect(MEASUREMENT_ORDER.women.fit as readonly string[]).toContain('dressLength');
    expect(MEASUREMENT_ORDER.men.fit as readonly string[]).toEqual(
      expect.arrayContaining(['jacketLength', 'shirtLength']),
    );
    expect(MEASUREMENT_ORDER.men.fit as readonly string[]).not.toContain('underbust');
  });

  it('gives each measurement a stable illustration ID', () => {
    expect(measurementIllustrationId('women', 'shoulder')).toBe('ILL-1101');
    expect(measurementIllustrationId('women', 'waist')).toBe('ILL-1103');
    expect(measurementIllustrationId('men', 'chest')).toBe('ILL-1202');
  });

  it('converts between centimetres and inches and stores centimetres', () => {
    expect(cmToInches(76.2)).toBe(30);
    expect(inchesToCm(30)).toBe(76.2);
    expect(toCentimetres({ waist: 30, hip: 40 }, 'in')).toEqual({ waist: 76.2, hip: 101.6 });
    expect(toCentimetres({ waist: 76 }, 'cm')).toEqual({ waist: 76 });
  });

  it('validates plausible ranges and rejects unknown measurements', () => {
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { waist: 78, hip: 100 } }).success).toBe(
      true,
    );
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { waist: 5 } }).success).toBe(false);
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { height: 170 } }).success).toBe(false);
  });

  it('reports missing body-type measurements', () => {
    expect(missingBodyTypeMeasurements('women', { waist: 78 })).toEqual(['shoulder', 'bust', 'hip', 'highHip']);
    expect(missingBodyTypeMeasurements('men', { shoulder: 110, chest: 95, waist: 80, hip: 95 })).toEqual([]);
  });

  it('validates category budgets and plain-text custom occasions', () => {
    expect(categoryBudgetsSchema.safeParse({ tops: 1500, bottoms: 2000 }).success).toBe(true);
    expect(categoryBudgetsSchema.safeParse({ hats: 500 }).success).toBe(false);
    expect(customOccasionsSchema.safeParse(['Sangeet night']).success).toBe(true);
    expect(customOccasionsSchema.safeParse(['https://example.com']).success).toBe(false);
  });

  it('requires confirmation to reset and never resets basic information', () => {
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['budget'], confirm: true }).success).toBe(true);
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['budget'] }).success).toBe(false);
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['basic_info'], confirm: true }).success).toBe(false);
  });
});

describe('body types (D-129)', () => {
  it('lists the founder’s body types per Clothing Preference, each with a description and proportion', () => {
    expect(BODY_TYPES_BY_DEPARTMENT.women).toEqual([
      'hourglass',
      'top_hourglass',
      'bottom_hourglass',
      'pear',
      'spoon',
      'rectangle',
      'inverted_triangle',
      'oval',
      'diamond',
    ]);
    expect(BODY_TYPES_BY_DEPARTMENT.men).toEqual(['rectangle', 'triangle', 'inverted_triangle', 'trapezoid', 'oval']);
    for (const id of BODY_TYPE_IDS) {
      expect(BODY_SHAPES.map((s) => s.id) as string[]).toContain(id);
      expect(BODY_TYPE_DESCRIPTIONS[id].length).toBeGreaterThan(10);
      expect(bodyTypeProportion(id)).not.toBeNull();
    }
  });

  it('a manual body type can be set, and only from the list', () => {
    expect(updateAppearanceRequestSchema.safeParse({ bodyType: { value: 'spoon' } }).success).toBe(true);
    expect(updateAppearanceRequestSchema.safeParse({ bodyType: { value: 'apple' } }).success).toBe(false);
  });

  it('needs every body-type measurement', () => {
    expect(classifyBodyType('women', inches({ bust: 36, waist: 28, hip: 38 }))).toBeNull();
  });

  it.each([
    ['hourglass', { shoulder: 39, bust: 36, waist: 26, hip: 36.5, highHip: 32 }],
    ['top_hourglass', { shoulder: 40, bust: 40, waist: 29, hip: 36, highHip: 33 }],
    ['bottom_hourglass', { shoulder: 38, bust: 35, waist: 27, hip: 40, highHip: 31 }],
    ['spoon', { shoulder: 38, bust: 35, waist: 28, hip: 40, highHip: 36 }],
    ['pear', { shoulder: 37, bust: 34, waist: 31, hip: 39, highHip: 35 }],
    ['inverted_triangle', { shoulder: 44, bust: 40, waist: 33, hip: 35, highHip: 34 }],
    ['rectangle', { shoulder: 38, bust: 35, waist: 30, hip: 36, highHip: 34 }],
    ['oval', { shoulder: 42, bust: 40, waist: 41, hip: 39, highHip: 40 }],
    ['diamond', { shoulder: 38, bust: 37, waist: 40, hip: 39, highHip: 39 }],
  ] as const)('women: %s', (expected, values) => {
    expect(classifyBodyType('women', inches(values))).toBe(expected);
  });

  it.each([
    ['rectangle', { shoulder: 44, chest: 38, waist: 36, hip: 38 }],
    ['triangle', { shoulder: 42, chest: 36, waist: 34, hip: 39 }],
    ['inverted_triangle', { shoulder: 50, chest: 44, waist: 33, hip: 38 }],
    ['trapezoid', { shoulder: 46, chest: 40, waist: 34, hip: 38 }],
    ['oval', { shoulder: 46, chest: 42, waist: 44, hip: 42 }],
  ] as const)('men: %s', (expected, values) => {
    expect(classifyBodyType('men', inches(values))).toBe(expected);
  });

  it('only ever returns a body type offered for that Clothing Preference', () => {
    for (let waist = 24; waist <= 50; waist += 2) {
      for (let hip = 30; hip <= 50; hip += 2) {
        const women = classifyBodyType('women', inches({ shoulder: 40, bust: 38, waist, hip, highHip: hip - 3 }));
        const men = classifyBodyType('men', inches({ shoulder: 44, chest: 40, waist, hip }));
        expect(BODY_TYPES_BY_DEPARTMENT.women as readonly string[]).toContain(women);
        expect(BODY_TYPES_BY_DEPARTMENT.men as readonly string[]).toContain(men);
      }
    }
  });
});

describe('photo contracts', () => {
  const photo = {
    id: 'a'.repeat(24),
    kind: 'body',
    angle: 'front',
    contentType: 'image/jpeg',
    bytes: 1000,
    retention: 'keep',
    uploadedAt: '2026-10-18T10:00:00.000Z',
    analyzedAt: null,
  };

  it('returns metadata without any storage key or URL', () => {
    expect(userPhotoSchema.safeParse(photo).success).toBe(true);
    expect(userPhotoSchema.safeParse({ ...photo, storageKey: 'users/x/y.jpg' }).success).toBe(false);
    expect(userPhotoSchema.safeParse({ ...photo, url: 'https://cdn/x.jpg' }).success).toBe(false);
  });

  it('keeps face and body uploads separate: only body photos have an angle', () => {
    expect(userPhotoSchema.safeParse({ ...photo, kind: 'face', angle: null }).success).toBe(true);
    expect(userPhotoSchema.safeParse({ ...photo, kind: 'face', angle: 'front' }).success).toBe(false);
    expect(userPhotoSchema.safeParse({ ...photo, angle: null }).success).toBe(false);
  });

  it('needs the current photo notice for an upload', () => {
    expect(uploadPhotoQuerySchema.safeParse({ kind: 'face', notice: PHOTO_NOTICE_VERSION }).success).toBe(true);
    expect(uploadPhotoQuerySchema.safeParse({ kind: 'face', notice: '2020-01-01' }).success).toBe(false);
    expect(uploadPhotoQuerySchema.safeParse({ kind: 'face' }).success).toBe(false);
  });

  it('accepts Gemini results only from the listed Monk tones, undertones and body types', () => {
    expect(faceAnalysisResultSchema.safeParse({ monkTone: 6, undertone: 'olive' }).success).toBe(true);
    expect(faceAnalysisResultSchema.safeParse({ monkTone: 11, undertone: 'warm' }).success).toBe(false);
    expect(faceAnalysisResultSchema.safeParse({ monkTone: 5, undertone: 'not_sure' }).success).toBe(false);
    expect(bodyAnalysisResultSchema.safeParse({ bodyType: 'trapezoid' }).success).toBe(true);
    expect(bodyAnalysisResultSchema.safeParse({ bodyType: 'athletic' }).success).toBe(false);
  });

  it('asks the user what to do with existing results when consent is revoked', () => {
    expect(photoConsentRequestSchema.safeParse({ action: 'grant', kind: 'face', noticeVersion: 'v1' }).success).toBe(
      true,
    );
    expect(photoConsentRequestSchema.safeParse({ action: 'revoke', kind: 'face' }).success).toBe(false);
    expect(
      photoConsentRequestSchema.safeParse({ action: 'revoke', kind: 'body', results: 'delete_results' }).success,
    ).toBe(true);
  });
});
