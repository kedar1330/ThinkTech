import { describe, expect, it } from 'vitest';
import { resolvePreferences } from '../../../src/services/engine';
import { applicableRules, type RuleScope } from '../../../src/services/engine/rules';
import { buildProfile } from '../../fixtures/profiles';
import { withRule } from './helpers';

// Height (D-131): the profile height becomes a height band, and rules scoped to height bands apply only to
// users in those bands, in the signal tier, whether or not appearance signals are switched on.

const SCOPE: RuleScope = { occasion: 'everyday', styles: ['casual'], templateDepartment: 'women' };

const PETITE_RULE = withRule({
  rationale: 'Synthetic fixture rationale: straight trousers keep one vertical line on a petite frame.',
  type: 'proportion',
  areas: ['fit'],
  appliesTo: { categories: ['trousers'], heights: ['petite'] },
  effect: { prefer: [{ attribute: 'silhouette', value: 'straight' }], weight: 0.5 },
});

const rulesFor = (heightCm: number | null) =>
  applicableRules(PETITE_RULE, 'trousers', SCOPE, resolvePreferences(buildProfile({ heightCm }), null)).filter(
    (r) => r.rule.id === 'STY-009',
  );

describe('height band in the engine (D-131)', () => {
  it('resolves the band from the profile height and Clothing Preference', () => {
    expect(resolvePreferences(buildProfile({ heightCm: 150 }), null).heightBand).toBe('petite');
    expect(resolvePreferences(buildProfile({ heightCm: 150, department: 'men' }), null).heightBand).toBe('petite');
    expect(resolvePreferences(buildProfile({ heightCm: 175, department: 'men' }), null).heightBand).toBe('average');
    expect(resolvePreferences(buildProfile({ heightCm: null }), null).heightBand).toBeNull();
  });

  it('applies a height-scoped rule only to users in that band, in the signal tier', () => {
    expect(rulesFor(150)).toEqual([expect.objectContaining({ tier: 'signal' })]);
    expect(rulesFor(165)).toEqual([]);
    expect(rulesFor(null)).toEqual([]);
  });
});
