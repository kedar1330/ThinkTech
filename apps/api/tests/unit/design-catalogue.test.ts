import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DESIGN_FEATURE_CATEGORIES } from '@styleme/contracts';
import { DESIGN_FEATURES, GARMENT_TYPES, INCOMPATIBLE_PAIRS } from '../../src/design/catalogue';
import { designIllustrations } from '../../src/design/illustrations';
import { evaluateSuitability, suitabilityRuleFileSchema, type MatchableRule } from '../../src/design/rules';
import { approvedSuitabilityRules } from '../../src/design/seed';

// Design-feature catalogue, images and rule files (D-132).

const drafts = suitabilityRuleFileSchema.parse(
  JSON.parse(readFileSync(new URL('../../style-rules-drafts/feature-suitability-rules.json', import.meta.url), 'utf8')),
);
const featureIds = new Set(DESIGN_FEATURES.map((f) => f.featureId));

describe('design catalogue data', () => {
  it('has unique feature IDs named <category>_<name>, each in a known category', () => {
    expect(featureIds.size).toBe(DESIGN_FEATURES.length);
    const categories = new Set<string>(DESIGN_FEATURE_CATEGORIES.map((c) => c.id));
    for (const f of DESIGN_FEATURES) {
      expect(f.featureId.startsWith(`${f.category}_`)).toBe(true);
      expect(categories.has(f.category)).toBe(true);
      expect(f.departments.length).toBeGreaterThan(0);
    }
  });

  it('gives every garment type at least one outfit category and department', () => {
    for (const g of GARMENT_TYPES) {
      expect(g.outfitCategories.length).toBeGreaterThan(0);
      expect(g.departments.length).toBeGreaterThan(0);
    }
  });

  it('names only real features in incompatible pairs', () => {
    for (const [a, b] of INCOMPATIBLE_PAIRS) {
      expect(featureIds.has(a)).toBe(true);
      expect(featureIds.has(b)).toBe(true);
    }
  });

  it('draws a card and a layer for every selectable neckline and sleeve, per department', () => {
    const images = designIllustrations();
    expect(new Set(images.map((i) => i.assetId)).size).toBe(images.length);
    for (const f of DESIGN_FEATURES.filter(
      (x) => (x.category === 'neckline' || x.category === 'sleeve') && x.selectable !== false,
    )) {
      for (const d of f.departments) {
        const mine = images.filter((i) => i.featureId === f.featureId && i.department === d);
        expect(mine.map((i) => i.kind).sort(), `${f.featureId} ${d}`).toEqual([
          'design_feature',
          'design_feature_layer',
        ]);
      }
    }
    for (const i of images) expect(i.svg).toMatch(/^<svg [^>]*viewBox="0 0 200 240"/);
  });
});

describe('suitability rule files', () => {
  it('ships only founder-approved rules', () => {
    expect(() => approvedSuitabilityRules()).not.toThrow();
  });

  it('keeps every draft a valid draft that names a real feature', () => {
    expect(drafts.rules.length).toBeGreaterThan(0);
    for (const r of drafts.rules) {
      expect(r.reviewStatus).toBe('draft');
      expect(featureIds.has(r.featureId), r.ruleId).toBe(true);
    }
  });
});

describe('evaluateSuitability', () => {
  const rule = (
    ruleId: string,
    featureId: string,
    c: Partial<MatchableRule['conditions']>,
    result: MatchableRule['recommendation']['result'],
    priority: number,
  ): MatchableRule => ({
    ruleId,
    featureId,
    departments: ['women'],
    applicableGarments: ['top'],
    conditions: { bodyTypes: [], heightBands: [], stylingGoals: [], ...c },
    recommendation: { result, reason: `${ruleId} reason` },
    priority,
  });
  const input = {
    department: 'women' as const,
    garmentKind: 'top' as const,
    bodyType: 'pear',
    heightBand: 'tall' as const,
    stylingGoals: [],
  };

  it('needs every non-empty condition to match', () => {
    const out = evaluateSuitability(
      [rule('A', 'neckline_v_neck', { bodyTypes: ['pear'], heightBands: ['petite'] }, 'recommended', 2)],
      input,
    );
    expect(out.size).toBe(0);
  });

  it('lets the lowest priority win and, on a tie, the more positive result', () => {
    const out = evaluateSuitability(
      [
        rule('A', 'sleeve_bell', { heightBands: ['tall'] }, 'not_preferred', 3),
        rule('B', 'sleeve_bell', { bodyTypes: ['pear'] }, 'alternative', 2),
        rule('C', 'sleeve_puff', { bodyTypes: ['pear'] }, 'not_preferred', 2),
        rule('D', 'sleeve_puff', { heightBands: ['tall'] }, 'recommended', 2),
      ],
      input,
    );
    expect(out.get('sleeve_bell')).toEqual({ result: 'alternative', reasons: ['B reason'], ruleIds: ['B'] });
    expect(out.get('sleeve_puff')?.result).toBe('recommended');
  });

  it('skips rules for other departments and garment kinds', () => {
    const r = rule('A', 'neckline_v_neck', { bodyTypes: ['pear'] }, 'recommended', 2);
    expect(evaluateSuitability([{ ...r, departments: ['men'] }], input).size).toBe(0);
    expect(evaluateSuitability([r], { ...input, garmentKind: 'bottom' }).size).toBe(0);
  });
});
