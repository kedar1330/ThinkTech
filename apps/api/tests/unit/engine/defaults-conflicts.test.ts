import { describe, expect, it } from 'vitest';
import { MAX_LOOKS } from '@styleme/contracts';
import { emptyProfile } from '../../../src/services/profile.service';
import { loadStyleLibrary } from '../../../src/style-rules';
import { buildEngineFixtureLibrary } from '../../fixtures/style-library';
import { loadFixtures, run, specs, templateIds } from './helpers';

// Defaults (T-16), conflicts (T-17) and insufficient matches (T-18, FR-LOOK-09 … 11).

describe('T-16 defaults', () => {
  it('T-16 only an occasion still returns looks and lists the defaults applied', () => {
    const result = run();
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.defaultsApplied).toEqual(['colors', 'signals', 'sizes', 'style']);
    expect(result.warnings).toContain('DEFAULTS_APPLIED');
  });

  it('T-16 with no department saved, department is a default too', () => {
    const result = run({}, { department: null });
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.defaultsApplied).toEqual(['department', 'colors', 'signals', 'sizes', 'style']);
  });

  it('T-16 a filled-in profile applies no defaults', () => {
    const result = run(
      { style: 'casual' },
      { likedColors: ['lavender'], sizes: { ...emptyProfile().sizes, shoes: { uk: 6 } } },
      { undertone: 'cool', skinTone: null, bodyProportions: null },
    );
    expect(result.defaultsApplied).toEqual([]);
    expect(result.warnings).not.toContain('DEFAULTS_APPLIED');
  });
});

describe('T-17 conflicts', () => {
  it('T-17 a colour both liked and disliked is left out, reported and explained', () => {
    const result = run({}, { likedColors: ['navy'], dislikedColors: ['navy'] });
    expect(result.conflicts).toEqual([{ field: 'colors', value: 'navy' }]);
    expect(result.warnings).toContain('PREFERENCE_CONFLICT');
    expect(specs(result).map((s) => s.colorId)).not.toContain('navy');
    for (const look of result.looks) {
      expect(look.explanation).toContain('Navy is in both your liked and disliked colours');
      expect(look.explanationRefs.attributes).toContainEqual({ attribute: 'conflict.colors', value: 'navy' });
    }
  });

  it('T-17 a fabric both liked and avoided is avoided, reported and explained', () => {
    const result = run({ occasion: 'work' }, { fabricPreferences: { liked: ['cotton'], avoided: ['cotton'] } });
    expect(result.conflicts).toEqual([{ field: 'fabrics', value: 'cotton' }]);
    expect(result.warnings).toContain('PREFERENCE_CONFLICT');
    expect(specs(result).map((s) => s.fabric)).not.toContain('cotton');
    for (const look of result.looks)
      expect(look.explanation).toContain('Cotton is in both your liked and avoided fabrics');
  });

  it('T-17 without a conflict there is no conflict warning', () => {
    expect(run({}, { likedColors: ['navy'], dislikedColors: ['rust'] }).warnings).not.toContain('PREFERENCE_CONFLICT');
  });
});

describe('T-18 insufficient matches', () => {
  it('T-18 a restrictive request returns fewer looks, never padded, and names the limit', () => {
    const result = run({ wearType: ['indian'] }, { department: 'men' });
    expect(templateIds(result)).toEqual(['OUT-003']);
    expect(result.looks.length).toBeLessThan(MAX_LOOKS);
    expect(result.warnings).toContain('INSUFFICIENT_MATCHES');
    expect(result.limitedBy).toEqual({ constraint: 'wearType', suggestion: expect.any(String) });
  });

  it('T-18 a style no template has names the style', () => {
    const result = run({ style: 'streetwear', occasion: 'work' });
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('style');
  });

  it('T-18 names coverage when coverage removed the only template', () => {
    const raw = buildEngineFixtureLibrary();
    const teeOnly = loadFixtures({
      ...raw,
      templates: raw.templates.filter((t) => (t as { id: string }).id === 'OUT-005'),
    });
    const coverage = { minSleeveLength: 'full', minGarmentLength: null, minNecklineCoverage: null } as const;
    const result = run({}, { coveragePreferences: coverage }, null, teeOnly);
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('coverage');
  });

  it('T-18 names avoided fabrics when they removed the only template', () => {
    const raw = buildEngineFixtureLibrary();
    const drapeOnly = loadFixtures({
      ...raw,
      templates: raw.templates.map((t) =>
        (t as { id: string }).id === 'OUT-004'
          ? {
              ...(t as object),
              slots: [
                {
                  slotId: 'outfit',
                  slot: 'one_piece',
                  categoryOptions: ['saree'],
                  colorRole: 'accent',
                  constraints: { fabrics: ['silk'] },
                },
                { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'], colorRole: 'neutral' },
              ],
            }
          : t,
      ),
    });
    const result = run(
      { occasion: 'festive' },
      { fabricPreferences: { liked: [], avoided: ['silk'] } },
      null,
      drapeOnly,
    );
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('avoidedFabrics');
  });

  it('T-18 an occasion with no approved templates returns no looks and says so', () => {
    const result = run({ occasion: 'date' });
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('occasion');
  });

  it('T-18 an empty library returns no looks without failing', () => {
    const empty = loadStyleLibrary({ palettes: [], stylingRules: [], fabricRules: [], templates: [] });
    const result = run({}, {}, null, empty);
    expect(result.looks).toEqual([]);
    expect(result.warnings).toContain('INSUFFICIENT_MATCHES');
  });

  it('T-18 a full set of looks has no limit and no warning', () => {
    const result = run({}, { department: 'any' });
    expect(result.looks.length).toBe(MAX_LOOKS);
    expect(result.limitedBy).toBeUndefined();
    expect(result.warnings).not.toContain('INSUFFICIENT_MATCHES');
  });
});
