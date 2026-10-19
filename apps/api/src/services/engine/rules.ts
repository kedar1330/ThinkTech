import type { Category, Department, Occasion, Style } from '@styleme/contracts';
import type { Attribute } from '../../style-rules/schemas';
import type { Rule, StyleLibrary } from './library';
import type { Preferences } from './preferences';
import { ZERO, type Score } from './score';

/** A rule that applies to one slot of one look, and the precedence tier its effect counts in. */
export interface ApplicableRule {
  rule: Rule;
  /** Rules scoped to body proportions are appearance signals (FR-LOOK-08 tier 4); the rest are rules. */
  tier: 'rule' | 'signal';
}

export interface RuleScope {
  occasion: Occasion;
  /** The request's style, or the template's styles when none was requested. */
  styles: readonly Style[];
  templateDepartment: Department;
}

const listMatches = <T>(list: readonly T[], values: readonly T[]) =>
  list.length === 0 || values.some((v) => list.includes(v));

/** Approved rules for a category whose `appliesTo` matches the look's context, in ID order. */
export function applicableRules(
  library: StyleLibrary,
  category: Category,
  scope: RuleScope,
  prefs: Preferences,
): ApplicableRule[] {
  const found: ApplicableRule[] = [];
  for (const rule of library.rulesForCategory(category)) {
    const { occasions, styles, departments, proportions } = rule.appliesTo;
    if (!listMatches(occasions, [scope.occasion])) continue;
    if (!listMatches(styles, scope.styles)) continue;
    if (!listMatches(departments, [scope.templateDepartment, prefs.department])) continue;
    if (proportions.length === 0) found.push({ rule, tier: 'rule' });
    else if (prefs.proportions && proportions.includes(prefs.proportions)) found.push({ rule, tier: 'signal' });
  }
  return found.sort((a, b) => a.rule.id.localeCompare(b.rule.id));
}

export type AttributeValues = Partial<Record<Attribute, string>>;

export interface RuleEffect {
  score: Score;
  /** Rules whose effect supported these values, with their contribution (for explanations). */
  supporting: Map<string, number>;
}

/** Soft rule effects on a set of attribute values: `prefer` adds the weight, `deprioritise` subtracts it. */
export function ruleEffects(rules: readonly ApplicableRule[], values: AttributeValues): RuleEffect {
  let score = ZERO;
  const supporting = new Map<string, number>();
  for (const { rule, tier } of rules) {
    let delta = 0;
    for (const ref of rule.effect.prefer) if (values[ref.attribute] === ref.value) delta += rule.effect.weight;
    for (const ref of rule.effect.deprioritise) if (values[ref.attribute] === ref.value) delta -= rule.effect.weight;
    if (delta === 0) continue;
    score = tier === 'rule' ? { ...score, rule: score.rule + delta } : { ...score, signal: score.signal + delta };
    if (delta > 0) supporting.set(rule.id, delta);
  }
  return { score, supporting };
}
