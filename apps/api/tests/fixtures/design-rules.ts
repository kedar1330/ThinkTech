import type { SuitabilityRuleRecord } from '../../src/design/rules';

// Synthetic, approved-for-test suitability rules (D-132). Not styling advice: they only exercise matching
// by body type, height band and goal, priorities, and the not-preferred path.

const base = {
  applicableGarments: [] as SuitabilityRuleRecord['applicableGarments'],
  version: 1,
  reviewStatus: 'approved' as const,
  reviewedBy: 'Test fixture',
  reviewedAt: '2026-10-22',
  isFixture: true as const,
};

const rule = (
  ruleId: string,
  featureId: string,
  departments: Array<'women' | 'men'>,
  conditions: Partial<SuitabilityRuleRecord['conditions']>,
  result: SuitabilityRuleRecord['recommendation']['result'],
  priority: number,
): SuitabilityRuleRecord => ({
  ...base,
  ruleId,
  featureId,
  departments,
  conditions: { bodyTypes: [], heightBands: [], stylingGoals: [], ...conditions },
  recommendation: { result, reason: `Fixture reason for ${featureId}.`, confidence: 'rule_based' },
  priority,
});

export const DESIGN_FIXTURE_RULES: SuitabilityRuleRecord[] = [
  rule('FSR-901', 'neckline_v_neck', ['women'], { bodyTypes: ['pear'] }, 'recommended', 2),
  rule('FSR-902', 'neckline_square_neck', ['women'], { bodyTypes: ['pear'] }, 'recommended', 2),
  rule('FSR-903', 'neckline_boat_neck', ['women'], { bodyTypes: ['pear'] }, 'not_preferred', 2),
  rule('FSR-904', 'neckline_scoop_neck', ['women'], { heightBands: ['petite'] }, 'alternative', 3),
  // Height says "not preferred", the user's goal says "recommended": the goal (priority 1) wins.
  rule('FSR-905', 'sleeve_bishop', ['women'], { heightBands: ['petite'] }, 'not_preferred', 3),
  rule('FSR-906', 'sleeve_bishop', ['women'], { stylingGoals: ['add_structure'] }, 'recommended', 1),
  rule('FSR-907', 'sleeve_three_quarter', ['women'], { heightBands: ['petite'] }, 'recommended', 3),
  rule('FSR-908', 'neckline_spread_collar', ['men'], { bodyTypes: ['triangle'] }, 'recommended', 2),
];
