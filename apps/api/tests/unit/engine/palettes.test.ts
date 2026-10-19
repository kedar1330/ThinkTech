import { describe, expect, it } from 'vitest';
import { paletteListResponseSchema, type ProfileResponse } from '@styleme/contracts';
import { listAllPalettes, rankPalettes, resolvePreferences, type EngineSignals } from '../../../src/services/engine';
import { buildProfile } from '../../fixtures/profiles';
import { library } from './helpers';

// Palette ranking for GET /v1/style/palettes (FR-PAL-01 … 03, T-33), including signals off (T-10).

const prefs = (profile: Partial<ProfileResponse>, signals: EngineSignals | null = null) =>
  resolvePreferences(buildProfile(profile), signals);

describe('T-33 palette ranking', () => {
  it('T-33 view=all lists every approved palette by ID with nothing suggested', () => {
    const all = listAllPalettes(library.palettes);
    expect(all.map((p) => p.id)).toEqual(['PAL-001', 'PAL-002', 'PAL-003']);
    expect(all.every((p) => p.suggestedBecause.length === 0)).toBe(true);
    expect(() => paletteListResponseSchema.parse({ palettes: all })).not.toThrow();
  });

  it('T-33 ranks undertone and skin tone first, when signals are enabled', () => {
    const ranked = rankPalettes(
      library.palettes,
      prefs({ likedColors: ['rust'] }, { undertone: 'cool', skinTone: '3-4', bodyProportions: null }),
    );
    expect(ranked[0]).toMatchObject({ id: 'PAL-002', suggestedBecause: ['undertone', 'skinTone'] });
    // A liked colour is never excluded by a suggestion (FR-PAL-03).
    expect(ranked.map((p) => p.id)).toContain('PAL-001');
  });

  it('T-33 without signals, liked colours rank palettes', () => {
    const ranked = rankPalettes(library.palettes, prefs({ likedColors: ['emerald'] }));
    expect(ranked[0]).toMatchObject({ id: 'PAL-003', suggestedBecause: ['likedColors'] });
  });

  it('T-33 suggestions leave out palettes with a disliked colour; view=all still shows them', () => {
    expect(rankPalettes(library.palettes, prefs({ dislikedColors: ['gold'] })).map((p) => p.id)).not.toContain(
      'PAL-003',
    );
    expect(listAllPalettes(library.palettes).map((p) => p.id)).toContain('PAL-003');
  });

  it('T-33 ranking is deterministic and every result matches the contract', () => {
    const p = prefs({ likedColors: ['navy', 'gold'], contrastPreference: 'high' });
    const ranked = rankPalettes(library.palettes, p);
    expect(rankPalettes(library.palettes, p)).toEqual(ranked);
    expect(() => paletteListResponseSchema.parse({ palettes: ranked })).not.toThrow();
  });
});

describe('T-10 palette ranking with signals off', () => {
  it('T-10 with signals off, ranking ignores undertone and skin tone and cites neither', () => {
    const off = rankPalettes(library.palettes, prefs({ likedColors: ['rust'] }, null));
    const on = rankPalettes(
      library.palettes,
      prefs({ likedColors: ['rust'] }, { undertone: 'cool', skinTone: '3-4', bodyProportions: null }),
    );
    expect(on[0]!.id).toBe('PAL-002');
    expect(off[0]!.id).toBe('PAL-001');
    for (const palette of off) {
      expect(palette.suggestedBecause).not.toContain('undertone');
      expect(palette.suggestedBecause).not.toContain('skinTone');
    }
  });

  it('T-10 cleared or "not sure" signals rank exactly as no signals', () => {
    const none = rankPalettes(library.palettes, prefs({}, null));
    const unsure = rankPalettes(
      library.palettes,
      prefs({}, { undertone: 'not_sure', skinTone: null, bodyProportions: 'prefer_not_to_say' }),
    );
    expect(unsure).toEqual(none);
  });
});
