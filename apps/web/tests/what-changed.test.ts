import { describe, expect, it } from 'vitest';
import type { LookInputs, ProfileResponse } from '@styleme/contracts';
import { inputsFromProfile, whatChanged } from '../lib/discover/what-changed';

// "What changed" for regenerate (#49): every changed profile field is listed in plain words.

const BEFORE: LookInputs = {
  department: 'women',
  departmentFiltered: true,
  likedColors: ['navy'],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
  coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
  fabricPreferences: { liked: [], avoided: [] },
  preferredStyles: [],
  sizesSaved: [],
  signalsUsed: false,
};

describe('whatChanged', () => {
  it('lists nothing when the inputs are the same', () => {
    expect(whatChanged(BEFORE, BEFORE)).toEqual([]);
  });

  it('names added and removed colours, fabrics, styles and shapes', () => {
    expect(
      whatChanged(BEFORE, {
        ...BEFORE,
        likedColors: ['teal', 'rust'],
        dislikedColors: ['maroon'],
        fabricPreferences: { liked: ['linen'], avoided: ['silk', 'satin'] },
        preferredStyles: ['smart_casual'],
        silhouettePreferences: ['wide_leg'],
      }),
    ).toEqual([
      'Your liked colours now include teal and rust.',
      'Your liked colours no longer include navy.',
      'Your avoided colours now include maroon.',
      'Your liked fabrics now include linen.',
      'Your avoided fabrics now include silk and satin.',
      'Your preferred styles now include smart casual.',
      'Your preferred shapes now include wide-leg.',
    ]);
  });

  it('describes department changes, including choosing and clearing one', () => {
    expect(whatChanged(BEFORE, { ...BEFORE, department: 'men' })).toEqual([
      'Your department changed from Women to Men.',
    ]);
    expect(whatChanged({ ...BEFORE, department: null }, BEFORE)).toEqual(['You chose a department: Women.']);
    expect(whatChanged(BEFORE, { ...BEFORE, department: null })).toEqual([
      'Your department was cleared, so looks can come from every department.',
    ]);
  });

  it('describes contrast, fit and coverage changes', () => {
    expect(
      whatChanged(
        { ...BEFORE, coveragePreferences: { ...BEFORE.coveragePreferences, minGarmentLength: 'knee' } },
        {
          ...BEFORE,
          contrastPreference: 'high',
          fitPreferences: { ...BEFORE.fitPreferences, ethnicTops: 'relaxed' },
          coveragePreferences: { minSleeveLength: 'full', minNecklineCoverage: 'high', minGarmentLength: null },
        },
      ),
    ).toEqual([
      'Your contrast preference changed to high.',
      'Your preferred fit for ethnic tops changed to relaxed.',
      'Your minimum sleeve length changed to full sleeve.',
      'Your minimum neckline coverage changed to high.',
      'Your minimum garment length was cleared.',
    ]);
  });

  it('describes sizes added and removed, and appearance signals switched on or off', () => {
    expect(
      whatChanged(
        { ...BEFORE, sizesSaved: ['shoes'] },
        { ...BEFORE, sizesSaved: ['tops', 'bottoms'], signalsUsed: true },
      ),
    ).toEqual([
      'You added your size for tops and bottoms.',
      'You removed your size for shoes.',
      'Your appearance signals are now used.',
    ]);
    expect(whatChanged({ ...BEFORE, signalsUsed: true }, { ...BEFORE, signalsUsed: false })).toEqual([
      'Your appearance signals are no longer used.',
    ]);
  });

  it('says nothing about signals when their current use is unknown', () => {
    const { signalsUsed: _ignored, ...withoutSignals } = BEFORE;
    expect(whatChanged({ ...BEFORE, signalsUsed: true }, withoutSignals)).toEqual([]);
  });
});

describe('inputsFromProfile', () => {
  it('takes the compared fields from a profile, with sizes named by group only', () => {
    const profile = {
      department: 'men',
      sizes: { tops: { letter: 'M' }, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: { uk: 9 } },
      fitPreferences: BEFORE.fitPreferences,
      likedColors: ['navy'],
      dislikedColors: ['red'],
      contrastPreference: null,
      silhouettePreferences: [],
      coveragePreferences: BEFORE.coveragePreferences,
      comfortPreferences: ['stretch'],
      fabricPreferences: { liked: [], avoided: [] },
      preferredStyles: ['casual'],
      preferredOccasions: ['work'],
      budgetPreference: null,
      updatedAt: null,
    } satisfies ProfileResponse;
    expect(inputsFromProfile(profile)).toEqual({
      department: 'men',
      likedColors: ['navy'],
      dislikedColors: ['red'],
      contrastPreference: null,
      silhouettePreferences: [],
      fitPreferences: BEFORE.fitPreferences,
      coveragePreferences: BEFORE.coveragePreferences,
      fabricPreferences: { liked: [], avoided: [] },
      preferredStyles: ['casual'],
      sizesSaved: ['tops', 'shoes'],
    });
  });
});
