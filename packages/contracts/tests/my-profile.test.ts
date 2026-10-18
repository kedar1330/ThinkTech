import { describe, expect, it } from 'vitest';
import {
  AGE_GROUP_IDS,
  BODY_MEASUREMENTS,
  ESSENTIAL_MEASUREMENT_IDS,
  bodyMeasurementsSchema,
  bodyShapeChoiceSchema,
  categoryBudgetsSchema,
  cmToInches,
  customOccasionsSchema,
  inchesToCm,
  missingEssentialMeasurements,
  photoConsentRequestSchema,
  resetPreferencesRequestSchema,
  toCentimetres,
  updateProfileRequestSchema,
  userPhotoSchema,
} from '../src';

// My Profile contracts (D-102 … D-105, approved 2026-10-18, not built).

describe('proposed My Profile contracts', () => {
  it('keeps the current profile contract unchanged: age and measurements are still rejected', () => {
    expect(updateProfileRequestSchema.safeParse({ department: 'women', ageGroup: '18_24' }).success).toBe(false);
    expect(
      updateProfileRequestSchema.safeParse({ department: 'women', measurements: { valuesCm: { waist: 70 } } }).success,
    ).toBe(false);
  });

  it('offers age groups only, never a date of birth', () => {
    expect(AGE_GROUP_IDS).toEqual(['under_18', '18_24', '25_34', '35_44', '45_plus']);
  });

  it('lists the five essential measurements first, with unique IDs', () => {
    expect(ESSENTIAL_MEASUREMENT_IDS).toEqual(['height', 'shoulderWidth', 'chestBust', 'waist', 'hipsSeat']);
    expect(new Set(BODY_MEASUREMENTS.map((m) => m.id)).size).toBe(BODY_MEASUREMENTS.length);
  });

  it('converts between centimetres and inches and stores centimetres', () => {
    expect(cmToInches(76.2)).toBe(30);
    expect(inchesToCm(30)).toBe(76.2);
    expect(toCentimetres({ waist: 30, height: 67 }, 'in')).toEqual({ waist: 76.2, height: 170.2 });
    expect(toCentimetres({ waist: 76 }, 'cm')).toEqual({ waist: 76 });
  });

  it('validates plausible ranges and rejects unknown measurements', () => {
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { waist: 78, height: 170 } }).success).toBe(
      true,
    );
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { waist: 5 } }).success).toBe(false);
    expect(bodyMeasurementsSchema.safeParse({ displayUnit: 'cm', valuesCm: { shoeSize: 9 } }).success).toBe(false);
  });

  it('reports missing essential measurements', () => {
    expect(missingEssentialMeasurements({ height: 170, waist: 78 })).toEqual([
      'shoulderWidth',
      'chestBust',
      'hipsSeat',
    ]);
  });

  it('accepts a manual body shape or "not sure"', () => {
    expect(bodyShapeChoiceSchema.safeParse('not_sure').success).toBe(true);
    expect(bodyShapeChoiceSchema.safeParse('balanced_defined_waist').success).toBe(true);
    expect(bodyShapeChoiceSchema.safeParse('pear').success).toBe(false);
  });

  it('validates category budgets and plain-text custom occasions', () => {
    expect(categoryBudgetsSchema.safeParse({ tops: 1500, bottoms: 2000 }).success).toBe(true);
    expect(categoryBudgetsSchema.safeParse({ hats: 500 }).success).toBe(false);
    expect(customOccasionsSchema.safeParse(['Sangeet night']).success).toBe(true);
    expect(customOccasionsSchema.safeParse(['https://example.com']).success).toBe(false);
  });

  it('requires confirmation to reset and never resets basic information', () => {
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['colours'], confirm: true }).success).toBe(true);
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['colours'] }).success).toBe(false);
    expect(resetPreferencesRequestSchema.safeParse({ sections: ['basic_info'], confirm: true }).success).toBe(false);
  });
});

describe('proposed photo contracts', () => {
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
