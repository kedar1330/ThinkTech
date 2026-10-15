import { describe, expect, it } from 'vitest';
import { PROFILE_COMPLETENESS_ITEMS, departmentScope, profileCompleteness, type ProfileResponse } from '../src';

const EMPTY: ProfileResponse = {
  department: null,
  sizes: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null },
  fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
  likedColors: [],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
  comfortPreferences: [],
  fabricPreferences: { liked: [], avoided: [] },
  preferredStyles: [],
  preferredOccasions: [],
  budgetPreference: null,
  updatedAt: null,
};

const FULL: ProfileResponse = {
  ...EMPTY,
  department: 'women',
  sizes: { ...EMPTY.sizes, tops: { letter: 'M' } },
  likedColors: ['emerald'],
  preferredOccasions: ['work'],
  preferredStyles: ['classic'],
  budgetPreference: 4000,
};

describe('profileCompleteness', () => {
  it('a skipped profile (nothing saved, no city) is missing every item, in display order', () => {
    const result = profileCompleteness(EMPTY, { city: null });
    expect(result.complete).toBe(false);
    expect(result.done).toBe(0);
    expect(result.total).toBe(PROFILE_COMPLETENESS_ITEMS.length);
    expect(result.missing.map((i) => i.id)).toEqual([
      'department',
      'city',
      'sizes',
      'likedColors',
      'occasions',
      'styles',
      'budget',
    ]);
  });

  it('a partial profile lists only what is missing', () => {
    const result = profileCompleteness({ ...EMPTY, department: 'men', likedColors: ['navy'] }, { city: 'pune' });
    expect(result.complete).toBe(false);
    expect(result.done).toBe(3);
    expect(result.missing.map((i) => i.id)).toEqual(['sizes', 'occasions', 'styles', 'budget']);
  });

  it('a full profile with a city is complete', () => {
    expect(profileCompleteness(FULL, { city: 'mumbai' })).toEqual({ complete: true, done: 7, total: 7, missing: [] });
  });

  it('optional details never make a profile incomplete (appearance, fit, coverage, fabrics, comfort, contrast)', () => {
    // FULL has none of them set and is still complete.
    expect(FULL.fitPreferences.tops).toBeNull();
    expect(FULL.comfortPreferences).toEqual([]);
    expect(profileCompleteness(FULL, { city: 'mumbai' }).complete).toBe(true);
  });

  it('the city comes from the account and is required for completeness', () => {
    expect(profileCompleteness(FULL, { city: null }).missing.map((i) => i.id)).toEqual(['city']);
  });

  it('every item has a label and a hint for the UI', () => {
    for (const item of PROFILE_COMPLETENESS_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('departmentScope', () => {
  it('without a department: general results across all departments, no department filter', () => {
    expect(departmentScope({ department: null })).toEqual({ department: 'any', filterApplied: false });
  });
  it('"Show me everything" is a choice, but also applies no department filter', () => {
    expect(departmentScope({ department: 'any' })).toEqual({ department: 'any', filterApplied: false });
  });
  it('a chosen department is applied', () => {
    expect(departmentScope({ department: 'women' })).toEqual({ department: 'women', filterApplied: true });
  });
});
