import { describe, expect, it } from 'vitest';
import { COLOR_IDS, FABRIC_IDS } from '@styleme/contracts';
import { profileFormToRequest } from '../lib/profile/profile-form';

const IDS = { colors: COLOR_IDS, fabrics: FABRIC_IDS };

function form(entries: [string, string][]) {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe('style profile form → PUT /v1/profile body', () => {
  it('requires a department', () => {
    expect(profileFormToRequest(form([]), IDS)).toEqual({
      ok: false,
      error: 'Choose a department — it is the only required field.',
    });
  });

  it('with only a department, sends the full cleared state', () => {
    const res = profileFormToRequest(form([['department', 'women']]), IDS);
    expect(res).toEqual({
      ok: true,
      body: {
        department: 'women',
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
      },
    });
  });

  it('builds sizes, fit, colour and fabric choices, lists and budget', () => {
    const res = profileFormToRequest(
      form([
        ['department', 'men'],
        ['size_tops_letter', 'L'],
        ['size_tops_collar', '15.5'],
        ['size_bottoms_waist', '32'],
        ['size_ethnicTops_numeric', '40'],
        ['size_shoes_uk', '9'],
        ['fit_tops', 'slim'],
        ['color_navy', 'like'],
        ['color_white', 'like'],
        ['color_fuchsia', 'avoid'],
        ['color_teal', ''],
        ['fabric_linen', 'like'],
        ['fabric_satin', 'avoid'],
        ['contrastPreference', 'high'],
        ['silhouettes', 'straight'],
        ['silhouettes', 'tapered'],
        ['coverage_sleeve', 'short'],
        ['comfort', 'breathable'],
        ['styles', 'classic'],
        ['occasions', 'work'],
        ['occasions', 'wedding'],
        ['budgetPreference', '4000'],
      ]),
      IDS,
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body.sizes).toEqual({
      tops: { letter: 'L', collarIn: 15.5 },
      bottoms: { waistIn: 32 },
      ethnicTops: { numeric: 40 },
      ethnicSets: null,
      shoes: { uk: 9 },
    });
    expect(res.body.fitPreferences?.tops).toBe('slim');
    expect(res.body.likedColors).toEqual(['white', 'navy']); // vocabulary order
    expect(res.body.dislikedColors).toEqual(['fuchsia']);
    expect(res.body.fabricPreferences).toEqual({ liked: ['linen'], avoided: ['satin'] });
    expect(res.body.silhouettePreferences).toEqual(['straight', 'tapered']);
    expect(res.body.coveragePreferences?.minSleeveLength).toBe('short');
    expect(res.body.preferredOccasions).toEqual(['work', 'wedding']);
    expect(res.body.budgetPreference).toBe(4000);
  });

  it('explains which field is wrong', () => {
    const bad = (entries: [string, string][]) => profileFormToRequest(form([['department', 'women'], ...entries]), IDS);
    expect(bad([['size_bottoms_waist', '80']])).toEqual({ ok: false, error: 'Please check the waist size.' });
    expect(bad([['budgetPreference', '0']])).toEqual({ ok: false, error: 'Please check the budget.' });
    expect(bad([['size_tops_collar', '15']])).toEqual({
      ok: false,
      error: 'Add a top size to go with the collar size.',
    });
    expect(bad([['size_bottoms_length', '30']])).toEqual({
      ok: false,
      error: 'Add a waist size to go with the length.',
    });
  });
});
