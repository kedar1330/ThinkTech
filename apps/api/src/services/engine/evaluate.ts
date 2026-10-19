import { z } from 'zod';
import {
  CATEGORIES,
  GARMENT_LENGTH_IDS,
  MAX_LOOKS,
  SLEEVE_LENGTH_IDS,
  departmentScope,
  departmentSchema,
  lookSchema,
  monkRangeSchema,
  proportionDescriptorSchema,
  recommendationRequestSchema,
  undertoneSchema,
  updateProfileRequestSchema,
  type LookSpec,
  type ProfileResponse,
  type RecommendationRequest,
} from '@styleme/contracts';
import { findJudgementalLanguage } from '../../style-rules/inclusive-language';
import { emptyProfile } from '../profile.service';
import { generateLooks, type EngineResult, type GeneratedLook } from './generate';
import { templateWearType, type StyleLibrary } from './library';
import type { EngineSignals } from './preferences';
import { MAX_ALTERNATIVES, MIN_ALTERNATIVES } from './slots';

// Evaluation entry point (#34, TESTING.md §6). Runs a set of synthetic profiles through the pure
// engine and applies the automated checks to every result: AC-05 … AC-08 (MVP.md §5) plus
// explanation fidelity, no product data and inclusive language. The evaluation dataset (#54) and the
// CLI (scripts/evaluate.ts) both call `runEvaluation`. Pure like the engine: no I/O and no AI.
//
// Profiles must be synthetic. Reports name profiles by ID only and never echo profile values.

export interface EvaluationProfile {
  /** A stable ID such as `EVAL-001`; the report names profiles by this only. */
  id: string;
  request: RecommendationRequest;
  profile: ProfileResponse;
  /** Self-reported signals as the engine sees them, or `null` (none, or switched off). */
  signals: EngineSignals | null;
}

export const EVALUATION_CHECKS = [
  'outcome',
  'contract',
  'deterministic',
  'hardConstraints',
  'templateFidelity',
  'uniqueSignatures',
  'alternatives',
  'explanationFidelity',
  'noProductData',
  'inclusiveLanguage',
] as const;
export type EvaluationCheckId = (typeof EVALUATION_CHECKS)[number];

/** What each check verifies, and the acceptance criterion or test it stands for. */
export const CHECK_DESCRIPTIONS: Record<EvaluationCheckId, string> = {
  outcome: 'At least one look, or no error and INSUFFICIENT_MATCHES naming the limit (AC-05, T-16, T-18)',
  contract: 'Every look matches the shared look contract',
  deterministic: 'The same input gives the same looks (AC-06, T-12)',
  hardConstraints: 'No disliked colour, avoided fabric, coverage or department violation (AC-07, T-13, T-15)',
  templateFidelity: 'Occasion, style, wear type, palette and category options come from the template (FR-LOOK-03)',
  uniqueSignatures: 'No repeated combination signature (AC-08, T-19)',
  alternatives: '0–5 distinct alternatives per slot; fewer than 3 only with ALTERNATIVES_LIMITED (AC-08, T-20)',
  explanationFidelity: 'Explanations quote exactly the rules and attributes in explanationRefs (T-21)',
  noProductData: 'No product, price, retailer, availability or link (T-23, T-24)',
  inclusiveLanguage: 'Explanations pass the inclusive-language check (T-22, FR-LOOK-19)',
};

export interface EvaluationCheck {
  id: EvaluationCheckId;
  passed: boolean;
  /** Why the check failed; empty when it passed. Record IDs and vocabulary IDs only. */
  failures: string[];
}

export interface EvaluationEntry {
  profileId: string;
  looks: GeneratedLook[];
  warnings: EngineResult['warnings'];
  limitedBy: EngineResult['limitedBy'];
  checks: EvaluationCheck[];
}

const FORBIDDEN_KEYS = new Set([
  'price',
  'priceSummary',
  'productMatch',
  'product',
  'retailer',
  'availability',
  'url',
  'link',
]);
const FORBIDDEN_TEXT = /https?:|www\.|₹|\bRs\.?\s?\d|\bINR\b/i;

/** Every look specification in a look: each slot and each of its alternatives. */
const specsOf = (look: GeneratedLook): LookSpec[] =>
  look.slots.flatMap((s) => [s.lookSpec, ...s.alternatives.map((a) => a.lookSpec)]);

const atLeast = (order: readonly string[], value: string, minimum: string) =>
  order.indexOf(value) >= order.indexOf(minimum);

function forbiddenContent(value: unknown, path: string, found: string[]): void {
  if (typeof value === 'string') {
    if (FORBIDDEN_TEXT.test(value)) found.push(`${path}: link or price text`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => forbiddenContent(item, `${path}[${i}]`, found));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) found.push(`${path}.${key}: product-layer field`);
      forbiddenContent(item, `${path}.${key}`, found);
    }
  }
}

/**
 * Applies every check except `deterministic` (which needs a second run) to one engine result.
 * Exported so tests can show that each check catches a broken result.
 */
export function checkResult(
  input: EvaluationProfile,
  result: EngineResult,
  library: StyleLibrary,
): Omit<Record<EvaluationCheckId, string[]>, 'deterministic'> {
  const { request, profile } = input;
  const { department } = departmentScope(profile);
  const disliked = new Set<string>(profile.dislikedColors);
  const avoided = new Set<string>(profile.fabricPreferences.avoided);
  const coverage = profile.coveragePreferences;
  const failures: Omit<Record<EvaluationCheckId, string[]>, 'deterministic'> = {
    outcome: [],
    contract: [],
    hardConstraints: [],
    templateFidelity: [],
    uniqueSignatures: [],
    alternatives: [],
    explanationFidelity: [],
    noProductData: [],
    inclusiveLanguage: [],
  };

  // AC-05: looks, or a clear "too few" answer; fewer than the maximum always names the limit.
  if (result.looks.length > MAX_LOOKS) failures.outcome.push(`${result.looks.length} looks (max ${MAX_LOOKS})`);
  if (result.looks.length < MAX_LOOKS && (!result.limitedBy || !result.warnings.includes('INSUFFICIENT_MATCHES'))) {
    failures.outcome.push(`${result.looks.length} looks without INSUFFICIENT_MATCHES and limitedBy`);
  }

  const signatures = new Set<string>();
  let anyLimited = false;
  // Only the StyleLibrary interface (D-110), so the checks also run on the MongoDB catalogue later.
  const rules = [...new Map(CATEGORIES.flatMap((c) => library.rulesForCategory(c.id)).map((r) => [r.id, r])).values()];
  const occasionTemplates = library.findTemplates({ occasion: request.occasion, department: 'any' });
  for (const look of result.looks) {
    const at = `${look.templateId}/${look.paletteId}`;
    const template = occasionTemplates.find((t) => t.id === look.templateId);
    const palette = library.getPalette(look.paletteId);

    const parsed = lookSchema.safeParse({ ...look, id: '0'.repeat(24), status: 'suggested', aiModel: null });
    if (!parsed.success) failures.contract.push(`${at}: ${parsed.error.issues[0]?.path.join('.') ?? 'invalid'}`);

    // AC-07: hard constraints, on every slot and every alternative.
    for (const spec of specsOf(look)) {
      const where = `${at} ${spec.category}`;
      if (disliked.has(spec.colorId)) failures.hardConstraints.push(`${where}: disliked colour ${spec.colorId}`);
      if (spec.fabric && avoided.has(spec.fabric))
        failures.hardConstraints.push(`${where}: avoided fabric ${spec.fabric}`);
      if (coverage.minSleeveLength && spec.sleeve && !atLeast(SLEEVE_LENGTH_IDS, spec.sleeve, coverage.minSleeveLength))
        failures.hardConstraints.push(`${where}: sleeve ${spec.sleeve} below ${coverage.minSleeveLength}`);
      if (
        coverage.minGarmentLength &&
        spec.length &&
        !atLeast(GARMENT_LENGTH_IDS, spec.length, coverage.minGarmentLength)
      )
        failures.hardConstraints.push(`${where}: length ${spec.length} below ${coverage.minGarmentLength}`);
      const category = CATEGORIES.find((c) => c.id === spec.category);
      if (!category || category.stage !== 1) failures.hardConstraints.push(`${where}: not a Stage 1 category`);
      else if (department !== 'any' && !(category.departments as readonly string[]).includes(department))
        failures.hardConstraints.push(`${where}: not offered to department ${department}`);
    }

    // The look is built from its template and a palette that may serve it.
    if (!template || !palette) {
      failures.templateFidelity.push(`${at}: palette unknown, or template unknown or not for ${request.occasion}`);
    } else {
      if (request.style && !template.styles.includes(request.style))
        failures.templateFidelity.push(`${at}: template not in style ${request.style}`);
      const wear = templateWearType(template);
      if (request.wearType && (wear === null || !request.wearType.includes(wear)))
        failures.templateFidelity.push(`${at}: wear type ${wear ?? 'none'} not requested`);
      if (template.compatiblePalettes.length > 0 && !template.compatiblePalettes.includes(palette.id))
        failures.templateFidelity.push(`${at}: palette not compatible with the template`);
      const own = new Set<string>([...palette.neutrals, ...palette.accents]);
      for (const slot of look.slots) {
        const templateSlot = template.slots.find((s) => s.slotId === slot.slotId);
        if (!templateSlot) {
          failures.templateFidelity.push(`${at} ${slot.slotId}: slot not in the template`);
          continue;
        }
        for (const spec of [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)]) {
          if (!templateSlot.categoryOptions.includes(spec.category))
            failures.templateFidelity.push(`${at} ${slot.slotId}: category ${spec.category} not a template option`);
          if (request.paletteMode === 'suggested' && !own.has(spec.colorId))
            failures.templateFidelity.push(`${at} ${slot.slotId}: ${spec.colorId} outside the palette`);
        }
      }
      for (const templateSlot of template.slots) {
        if (!templateSlot.optional && !look.slots.some((s) => s.slotId === templateSlot.slotId))
          failures.templateFidelity.push(`${at}: required slot ${templateSlot.slotId} missing`);
      }
    }

    // AC-08: unique signatures, and alternatives that are real, distinct and never padded.
    if (signatures.has(look.combinationSignature)) failures.uniqueSignatures.push(`${at}: repeated signature`);
    signatures.add(look.combinationSignature);
    for (const slot of look.slots) {
      if (slot.alternatives.length > MAX_ALTERNATIVES)
        failures.alternatives.push(`${at} ${slot.slotId}: ${slot.alternatives.length} alternatives`);
      if (slot.alternatives.length < MIN_ALTERNATIVES) anyLimited = true;
      const keys = [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)].map((s) =>
        JSON.stringify(Object.entries(s).sort(([a], [b]) => a.localeCompare(b))),
      );
      if (new Set(keys).size !== keys.length)
        failures.alternatives.push(`${at} ${slot.slotId}: repeated or unchanged alternative`);
    }

    // T-21: every referenced rule is quoted, and every quoted rationale belongs to a referenced rule.
    // Compared by text, since two records may share a rationale (the synthetic scale library does).
    const referenced = look.explanationRefs.ruleIds;
    const referencedText = new Set<string>();
    for (const id of referenced) {
      const rule = library.getRule(id);
      if (!rule) failures.explanationFidelity.push(`${at}: unknown rule ${id}`);
      else if (!look.explanation.includes(rule.rationale))
        failures.explanationFidelity.push(`${at}: ${id} referenced but not quoted`);
      else referencedText.add(rule.rationale);
    }
    for (const rule of rules) {
      if (look.explanation.includes(rule.rationale) && !referencedText.has(rule.rationale)) {
        failures.explanationFidelity.push(`${at}: ${rule.id} quoted but not referenced`);
        referencedText.add(rule.rationale);
      }
    }
    const attributes = look.explanationRefs.attributes;
    const has = (attribute: string, value: string) =>
      attributes.some((a) => a.attribute === attribute && a.value === value);
    if (!has('template', look.templateId) || !has('palette', look.paletteId) || !has('occasion', request.occasion))
      failures.explanationFidelity.push(`${at}: template, palette or occasion reference missing`);
    const colours = new Set(look.slots.map((s) => s.lookSpec.colorId as string));
    for (const a of attributes.filter((x) => x.attribute === 'likedColor')) {
      if (!colours.has(a.value) || !(profile.likedColors as string[]).includes(a.value))
        failures.explanationFidelity.push(`${at}: liked colour ${a.value} claimed but not used`);
    }
    if (input.signals === null && attributes.some((x) => ['undertone', 'skinTone'].includes(x.attribute)))
      failures.explanationFidelity.push(`${at}: an appearance signal is cited while signals are off`);

    forbiddenContent(look, at, failures.noProductData);

    const judgemental = findJudgementalLanguage(look.explanation);
    if (judgemental.length > 0) failures.inclusiveLanguage.push(`${at}: ${judgemental.join(', ')}`);
  }
  if (anyLimited !== result.warnings.includes('ALTERNATIVES_LIMITED')) {
    failures.alternatives.push(
      anyLimited
        ? 'a slot has fewer than 3 alternatives without ALTERNATIVES_LIMITED'
        : 'ALTERNATIVES_LIMITED without cause',
    );
  }
  return failures;
}

function evaluateOne(input: EvaluationProfile, library: StyleLibrary): EvaluationEntry {
  const run = () => generateLooks({ request: input.request, profile: input.profile, signals: input.signals, library });
  let result: EngineResult;
  try {
    result = run();
  } catch (error) {
    // AC-05: the engine must never fail on a valid request. Only the error type is reported.
    const failures = [`the engine threw ${error instanceof Error ? error.name : 'an error'}`];
    return {
      profileId: input.id,
      looks: [],
      warnings: [],
      limitedBy: undefined,
      checks: EVALUATION_CHECKS.map((id) => ({ id, passed: false, failures: id === 'outcome' ? failures : [] })),
    };
  }
  const failures = checkResult(input, result, library);
  const deterministic = JSON.stringify(run()) === JSON.stringify(result) ? [] : ['a second run gave other looks'];
  const all: Record<EvaluationCheckId, string[]> = { ...failures, deterministic };
  return {
    profileId: input.id,
    looks: result.looks,
    warnings: result.warnings,
    limitedBy: result.limitedBy,
    checks: EVALUATION_CHECKS.map((id) => ({ id, passed: all[id].length === 0, failures: all[id] })),
  };
}

/** Runs each profile through the engine on `library` and checks the result (TESTING.md §6). */
export function runEvaluation(profiles: readonly EvaluationProfile[], library: StyleLibrary): EvaluationEntry[] {
  const ids = new Set<string>();
  for (const { id } of profiles) {
    if (ids.has(id)) throw new Error(`Duplicate evaluation profile ID ${id}`);
    ids.add(id);
  }
  return profiles.map((profile) => evaluateOne(profile, library));
}

export interface EvaluationSummary {
  contentVersion: string;
  profiles: number;
  /** Profiles with every check passed. */
  passed: number;
  looks: number;
  /** Profiles that got no looks (a `200` with INSUFFICIENT_MATCHES). */
  withoutLooks: number;
  checks: Record<EvaluationCheckId, { passed: number; failed: number }>;
}

export function summarizeEvaluation(entries: readonly EvaluationEntry[], library: StyleLibrary): EvaluationSummary {
  const checks = Object.fromEntries(EVALUATION_CHECKS.map((id) => [id, { passed: 0, failed: 0 }])) as Record<
    EvaluationCheckId,
    { passed: number; failed: number }
  >;
  for (const entry of entries) for (const check of entry.checks) checks[check.id][check.passed ? 'passed' : 'failed']++;
  return {
    contentVersion: library.contentVersion,
    profiles: entries.length,
    passed: entries.filter((e) => e.checks.every((c) => c.passed)).length,
    looks: entries.reduce((n, e) => n + e.looks.length, 0),
    withoutLooks: entries.filter((e) => e.looks.length === 0).length,
    checks,
  };
}

/** A Markdown report for the founder review and the #54 records. IDs and counts only. */
export function formatEvaluationReport(entries: readonly EvaluationEntry[], library: StyleLibrary): string {
  const summary = summarizeEvaluation(entries, library);
  const lines = [
    '## Engine evaluation',
    '',
    `Content version \`${summary.contentVersion}\` · ${summary.profiles} profiles · ${summary.looks} looks · ` +
      `${summary.passed}/${summary.profiles} profiles pass every check · ${summary.withoutLooks} with no looks`,
    '',
    '| Check | What it verifies | Passed | Failed |',
    '|---|---|---|---|',
    ...EVALUATION_CHECKS.map(
      (id) => `| \`${id}\` | ${CHECK_DESCRIPTIONS[id]} | ${summary.checks[id].passed} | ${summary.checks[id].failed} |`,
    ),
    '',
    '| Profile | Looks | Templates | Warnings | Limited by | Failed checks |',
    '|---|---|---|---|---|---|',
    ...entries.map((e) => {
      const failed = e.checks.filter((c) => !c.passed).map((c) => c.id);
      const templates = [...new Set(e.looks.map((l) => l.templateId))].join(', ') || '—';
      return `| ${e.profileId} | ${e.looks.length} | ${templates} | ${e.warnings.join(', ') || '—'} | ${e.limitedBy?.constraint ?? '—'} | ${failed.join(', ') || 'none'} |`;
    }),
  ];
  const details = entries.flatMap((e) =>
    e.checks.filter((c) => !c.passed).flatMap((c) => c.failures.map((f) => `- ${e.profileId} \`${c.id}\`: ${f}`)),
  );
  if (details.length > 0) lines.push('', '### Failures', '', ...details);
  return lines.join('\n');
}

// --- Profiles from JSON (the CLI and the #54 dataset) ------------------------------------------------

/**
 * One evaluation profile as JSON: the request, the profile fields as `PUT /v1/profile` takes them
 * (`department` may be `null` for "not saved") and optional self-reported signals.
 */
export const evaluationProfileInputSchema = z
  .object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
    request: recommendationRequestSchema,
    profile: updateProfileRequestSchema.extend({ department: departmentSchema.nullable() }),
    signals: z
      .object({
        undertone: undertoneSchema.nullable().default(null),
        skinTone: monkRangeSchema.nullable().default(null),
        bodyProportions: proportionDescriptorSchema.nullable().default(null),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();
export type EvaluationProfileInput = z.input<typeof evaluationProfileInputSchema>;

/** Builds an engine profile from profile fields: omitted and `null` fields stay empty. */
export function toEvaluationProfile(input: EvaluationProfileInput): EvaluationProfile {
  const { id, request, profile, signals } = evaluationProfileInputSchema.parse(input);
  const base = emptyProfile();
  const merged: ProfileResponse = { ...base, department: profile.department };
  for (const [key, value] of Object.entries(profile)) {
    if (key === 'department' || value === undefined || value === null) continue;
    const empty = base[key as keyof ProfileResponse];
    // Objects (sizes, fit, coverage, fabrics) keep their empty keys; lists and scalars are replaced.
    (merged as unknown as Record<string, unknown>)[key] =
      empty && typeof empty === 'object' && !Array.isArray(empty) ? { ...empty, ...(value as object) } : value;
  }
  return { id, request, profile: merged, signals };
}
