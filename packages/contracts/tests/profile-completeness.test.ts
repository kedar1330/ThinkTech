import { describe, expect, it } from 'vitest';
import {
  PROFILE_COMPLETENESS_ITEMS,
  departmentScope,
  heightBand,
  profileCompleteness,
  type AppearanceAttribute,
} from '../src';

const attr = <T>(value: T): AppearanceAttribute<T> => ({
  value,
  source: 'self_reported',
  userConfirmed: true,
  confirmedAt: '2026-10-22T10:00:00.000Z',
  estimate: null,
});

const NO_APPEARANCE = { skinTone: null, undertone: null, bodyType: null };
const FULL_APPEARANCE = {
  skinTone: attr({ monkRange: '5-5' }),
  undertone: attr('warm' as const),
  bodyType: attr('pear' as const),
};

describe('profileCompleteness (D-129, D-131)', () => {
  it('a skipped profile (nothing saved, no city) is missing every item, in display order', () => {
    const result = profileCompleteness({ department: null, heightCm: null }, { city: null }, NO_APPEARANCE);
    expect(result.complete).toBe(false);
    expect(result.done).toBe(0);
    expect(result.total).toBe(PROFILE_COMPLETENESS_ITEMS.length);
    expect(result.missing.map((i) => i.id)).toEqual(['department', 'height', 'city', 'skinTone', 'bodyType']);
  });

  it('a partial profile lists only what is missing; skin tone needs the undertone too', () => {
    const result = profileCompleteness(
      { department: 'men', heightCm: 175 },
      { city: 'pune' },
      { ...NO_APPEARANCE, skinTone: FULL_APPEARANCE.skinTone },
    );
    expect(result.done).toBe(3);
    expect(result.missing.map((i) => i.id)).toEqual(['skinTone', 'bodyType']);
  });

  it('a profile without a height is not complete', () => {
    const result = profileCompleteness({ department: 'women', heightCm: null }, { city: 'mumbai' }, FULL_APPEARANCE);
    expect(result.missing.map((i) => i.id)).toEqual(['height']);
  });

  it('a full profile with a city is complete', () => {
    expect(profileCompleteness({ department: 'women', heightCm: 160 }, { city: 'mumbai' }, FULL_APPEARANCE)).toEqual({
      complete: true,
      done: 5,
      total: 5,
      missing: [],
    });
  });

  it('an old "Show me everything" department must be chosen again', () => {
    const result = profileCompleteness({ department: 'any', heightCm: 160 }, { city: 'mumbai' }, FULL_APPEARANCE);
    expect(result.missing.map((i) => i.id)).toEqual(['department']);
  });

  it('appearance that could not be loaded counts as missing', () => {
    const result = profileCompleteness({ department: 'women', heightCm: 160 }, { city: 'mumbai' }, null);
    expect(result.missing.map((i) => i.id)).toEqual(['skinTone', 'bodyType']);
  });

  it('every item has a label and a hint for the UI', () => {
    for (const item of PROFILE_COMPLETENESS_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.hint.length).toBeGreaterThan(0);
    }
  });
});

describe('heightBand (D-131)', () => {
  it('uses the band limits of the Clothing Preference', () => {
    expect(heightBand('women', 156)).toBe('petite');
    expect(heightBand('women', 157)).toBe('average');
    expect(heightBand('women', 170)).toBe('tall');
    expect(heightBand('men', 167)).toBe('petite');
    expect(heightBand('men', 175)).toBe('average');
    expect(heightBand('men', 183)).toBe('tall');
  });
  it('is null without a height or a Women’s / Men’s Wear preference', () => {
    expect(heightBand('women', null)).toBeNull();
    expect(heightBand(null, 160)).toBeNull();
    expect(heightBand('any', 160)).toBeNull();
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
