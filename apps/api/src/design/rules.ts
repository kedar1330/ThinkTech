import {
  bodyShapeSchema,
  clothingPreferenceSchema,
  designFeatureIdSchema,
  garmentKindSchema,
  heightBandSchema,
  reviewStatusSchema,
  ruleConfidenceSchema,
  stylingGoalSchema,
  suitabilityResultSchema,
  suitabilityRuleIdSchema,
  type ClothingPreference,
  type GarmentKind,
  type HeightBand,
  type SuitabilityResult,
} from '@styleme/contracts';
import { z } from 'zod';
import { findJudgementalLanguage } from '../style-rules/inclusive-language';

// Feature suitability rules (D-132): the record format of `style-rules-drafts/feature-suitability-rules.json`
// (drafts) and `src/style-rules/data/feature-suitability-rules.json` (founder-approved, D-62), and the
// deterministic matcher that turns a user's body type, height band and goals into a result per feature.

export const suitabilityRuleRecordSchema = z
  .object({
    ruleId: suitabilityRuleIdSchema,
    featureId: designFeatureIdSchema,
    departments: z.array(clothingPreferenceSchema).min(1),
    applicableGarments: z.array(garmentKindSchema).default([]),
    conditions: z
      .object({
        bodyTypes: z.array(bodyShapeSchema).default([]),
        heightBands: z.array(heightBandSchema).default([]),
        stylingGoals: z.array(stylingGoalSchema).default([]),
      })
      .strict(),
    recommendation: z
      .object({
        result: suitabilityResultSchema,
        reason: z
          .string()
          .trim()
          .min(10)
          .max(300)
          .refine((t) => findJudgementalLanguage(t).length === 0, 'Use neutral, non-judgemental wording'),
        confidence: ruleConfidenceSchema.default('rule_based'),
      })
      .strict(),
    priority: z.number().int().min(1).max(9),
    version: z.number().int().min(1),
    reviewStatus: reviewStatusSchema,
    reviewedBy: z.string().trim().min(1).max(100).nullable(),
    reviewedAt: z.iso.date().nullable(),
    // Synthetic test records only (CONTRIBUTING.md §5). Never present in the shipped files.
    isFixture: z.literal(true).optional(),
  })
  .strict()
  .refine((r) => r.reviewStatus !== 'approved' || (r.reviewedBy !== null && r.reviewedAt !== null), {
    message: 'approved rules need reviewedBy and reviewedAt',
  })
  .refine((r) => Object.values(r.conditions).some((list) => list.length > 0), {
    message: 'a rule needs at least one condition (body type, height band or goal)',
  });
export type SuitabilityRuleRecord = z.infer<typeof suitabilityRuleRecordSchema>;

export const suitabilityRuleFileSchema = z
  .object({ limitations: z.string().min(10), rules: z.array(suitabilityRuleRecordSchema) })
  .strict()
  .refine((f) => new Set(f.rules.map((r) => r.ruleId)).size === f.rules.length, { message: 'duplicate ruleId' });

// --- Matching ------------------------------------------------------------------------------------------

export interface MatchableRule {
  ruleId: string;
  featureId: string;
  departments: string[];
  applicableGarments: string[];
  conditions: { bodyTypes: string[]; heightBands: string[]; stylingGoals: string[] };
  recommendation: { result: SuitabilityResult; reason: string };
  priority: number;
}

export interface SuitabilityInput {
  department: ClothingPreference;
  garmentKind: GarmentKind;
  /** Null when not given, or when the user turned appearance signals off for recommendations. */
  bodyType: string | null;
  heightBand: HeightBand | null;
  stylingGoals: string[];
}

export interface FeatureSuitability {
  result: SuitabilityResult;
  reasons: string[];
  ruleIds: string[];
}

const RESULT_ORDER: Record<SuitabilityResult, number> = { recommended: 0, alternative: 1, not_preferred: 2 };

function matches(rule: MatchableRule, input: SuitabilityInput): boolean {
  if (rule.departments.length > 0 && !rule.departments.includes(input.department)) return false;
  if (rule.applicableGarments.length > 0 && !rule.applicableGarments.includes(input.garmentKind)) return false;
  const { bodyTypes, heightBands, stylingGoals } = rule.conditions;
  if (bodyTypes.length > 0 && (input.bodyType === null || !bodyTypes.includes(input.bodyType))) return false;
  if (heightBands.length > 0 && (input.heightBand === null || !heightBands.includes(input.heightBand))) return false;
  if (stylingGoals.length > 0 && !stylingGoals.some((g) => input.stylingGoals.includes(g))) return false;
  return true;
}

/**
 * The result for every feature at least one rule speaks to. When rules disagree, the lowest `priority`
 * wins (the user's own goals first, then body type, then height band); on a tie the more positive result
 * wins, since rules are soft preferences (FR-STY-04). Reasons list the winning result's rules only.
 */
export function evaluateSuitability(rules: MatchableRule[], input: SuitabilityInput): Map<string, FeatureSuitability> {
  const byFeature = new Map<string, MatchableRule[]>();
  for (const rule of rules) {
    if (!matches(rule, input)) continue;
    byFeature.set(rule.featureId, [...(byFeature.get(rule.featureId) ?? []), rule]);
  }
  const out = new Map<string, FeatureSuitability>();
  for (const [featureId, matched] of byFeature) {
    const sorted = [...matched].sort(
      (a, b) =>
        a.priority - b.priority || RESULT_ORDER[a.recommendation.result] - RESULT_ORDER[b.recommendation.result],
    );
    const result = sorted[0]!.recommendation.result;
    const winners = sorted.filter((r) => r.recommendation.result === result);
    out.set(featureId, {
      result,
      reasons: [...new Set(winners.map((r) => r.recommendation.reason))],
      ruleIds: winners.map((r) => r.ruleId),
    });
  }
  return out;
}
