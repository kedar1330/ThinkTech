import { describe, expect, it } from 'vitest';
import { FABRIC_IDS } from '@styleme/contracts';
import { RETIRED_PROFILE_FIELDS, cmToFeetInches, profileFormToRequest } from '../lib/profile/profile-form';

const IDS = { fabrics: FABRIC_IDS };

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe('My Profile basics form → PUT /v1/profile body (D-129)', () => {
  it('requires the Clothing Preference: Women’s Wear or Men’s Wear only', () => {
    const error = { ok: false, error: 'Choose your clothing preference: Women’s Wear or Men’s Wear.' };
    expect(profileFormToRequest(form([]), IDS)).toEqual(error);
    expect(profileFormToRequest(form([['department', 'any']]), IDS)).toEqual(error);
  });

  it('with only a Clothing Preference, clears the fields My Profile no longer asks for', () => {
    expect(profileFormToRequest(form([['department', 'women']]), IDS)).toEqual({
      ok: true,
      body: {
        department: 'women',
        ageGroup: null,
        heightCm: null,
        budgetPreference: null,
        fabricPreferences: { liked: [], avoided: [] },
        ...RETIRED_PROFILE_FIELDS,
      },
    });
    // Colours, fit, contrast, silhouettes, coverage, comfort, styles, occasions and letter sizes.
    expect(Object.keys(RETIRED_PROFILE_FIELDS).sort()).toEqual(
      [
        'comfortPreferences',
        'contrastPreference',
        'coveragePreferences',
        'dislikedColors',
        'fitPreferences',
        'likedColors',
        'preferredOccasions',
        'preferredStyles',
        'silhouettePreferences',
        'sizes',
      ].sort(),
    );
  });

  it('builds the age group, budget and fabric choices', () => {
    const res = profileFormToRequest(
      form([
        ['department', 'men'],
        ['ageGroup', '25_34'],
        ['budgetPreference', '4000'],
        ['fabric_linen', 'like'],
        ['fabric_satin', 'avoid'],
        ['fabric_cotton', ''],
      ]),
      IDS,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body).toMatchObject({
      department: 'men',
      ageGroup: '25_34',
      budgetPreference: 4000,
      fabricPreferences: { liked: ['linen'], avoided: ['satin'] },
    });
  });

  it('D-131: takes the height in centimetres or in feet and inches, stored in whole centimetres', () => {
    const height = (entries: [string, string][]) => {
      const res = profileFormToRequest(form([['department', 'women'], ...entries]), IDS);
      return res.ok ? res.body.heightCm : res.error;
    };
    expect(
      height([
        ['heightUnit', 'cm'],
        ['heightCm', '162'],
      ]),
    ).toBe(162);
    expect(
      height([
        ['heightUnit', 'ft_in'],
        ['heightFt', '5'],
        ['heightIn', '4'],
      ]),
    ).toBe(163);
    expect(
      height([
        ['heightUnit', 'ft_in'],
        ['heightFt', '6'],
        ['heightIn', ''],
      ]),
    ).toBe(183);
    expect(
      height([
        ['heightUnit', 'ft_in'],
        ['heightFt', ''],
        ['heightIn', ''],
      ]),
    ).toBeNull();
    expect(
      height([
        ['heightUnit', 'cm'],
        ['heightCm', ''],
      ]),
    ).toBeNull();
    const error = 'Please check your height: between 120 and 230 cm (3 ft 11 in to 7 ft 6 in).';
    expect(
      height([
        ['heightUnit', 'cm'],
        ['heightCm', '90'],
      ]),
    ).toBe(error);
    expect(
      height([
        ['heightUnit', 'cm'],
        ['heightCm', 'tall'],
      ]),
    ).toBe(error);
  });

  it('shows a saved height in feet and inches', () => {
    expect(cmToFeetInches(163)).toEqual({ feet: 5, inches: 4 });
    expect(cmToFeetInches(183)).toEqual({ feet: 6, inches: 0 });
  });

  it('explains which field is wrong', () => {
    const bad = (entries: [string, string][]) => profileFormToRequest(form([['department', 'women'], ...entries]), IDS);
    expect(bad([['budgetPreference', '0']])).toEqual({
      ok: false,
      error: 'Please check the budget: whole rupees, above 0.',
    });
    expect(bad([['ageGroup', '17']])).toEqual({ ok: false, error: 'Please choose an age group from the list.' });
  });
});
