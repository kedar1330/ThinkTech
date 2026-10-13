import { describe, expect, it } from 'vitest';
import { CLEAR_ALL_SIGNALS, appearanceFormToRequest } from '../lib/profile/appearance-form';

describe('appearance form → PUT /v1/appearance body', () => {
  it('builds a full update from the chosen values', () => {
    expect(
      appearanceFormToRequest({
        monkFrom: '4',
        monkTo: '5',
        undertone: 'warm',
        bodyProportions: 'balanced_defined_waist',
        useInRecommendations: 'on',
      }),
    ).toEqual({
      ok: true,
      body: {
        skinTone: { value: { monkRange: '4-5' } },
        undertone: { value: 'warm' },
        bodyProportions: { value: 'balanced_defined_waist' },
        useInRecommendations: true,
      },
    });
  });

  it('treats empty choices as cleared and an unticked box as off', () => {
    expect(appearanceFormToRequest({})).toEqual({
      ok: true,
      body: {
        skinTone: { value: null },
        undertone: { value: null },
        bodyProportions: { value: null },
        useInRecommendations: false,
      },
    });
  });

  it('accepts a single tone and puts a reversed range in order', () => {
    const single = appearanceFormToRequest({ monkFrom: '7' });
    expect(single.ok && single.body.skinTone).toEqual({ value: { monkRange: '7-7' } });
    const reversed = appearanceFormToRequest({ monkFrom: '6', monkTo: '4' });
    expect(reversed.ok && reversed.body.skinTone).toEqual({ value: { monkRange: '4-6' } });
  });

  it('rejects a range wider than three neighbouring tones', () => {
    const res = appearanceFormToRequest({ monkFrom: '2', monkTo: '8' });
    expect(res.ok).toBe(false);
  });

  it('rejects values outside the vocabulary', () => {
    expect(appearanceFormToRequest({ undertone: 'golden' }).ok).toBe(false);
    expect(appearanceFormToRequest({ bodyProportions: 'pear' }).ok).toBe(false);
  });

  it('"delete all" clears the three signals and leaves the toggle alone', () => {
    expect(CLEAR_ALL_SIGNALS).toEqual({
      skinTone: { value: null },
      undertone: { value: null },
      bodyProportions: { value: null },
    });
    expect(CLEAR_ALL_SIGNALS).not.toHaveProperty('useInRecommendations');
  });
});
