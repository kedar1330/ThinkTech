import { describe, expect, it } from 'vitest';
import {
  EVALUATION_CHECKS,
  checkResult,
  evaluationProfileInputSchema,
  formatEvaluationReport,
  generateLooks,
  runEvaluation,
  summarizeEvaluation,
  toEvaluationProfile,
  type EngineResult,
  type EvaluationProfile,
} from '../../../src/services/engine';
import { edgeCaseProfiles, evaluationProfile } from '../../fixtures/profiles';
import { library } from './helpers';

// The evaluation entry point (#34) that #54 runs its dataset through: it passes on correct results,
// and each check catches the defect it exists for.

const engine = (p: EvaluationProfile) =>
  generateLooks({ request: p.request, profile: p.profile, signals: p.signals, library });
const clone = (result: EngineResult): EngineResult => structuredClone(result);

describe('runEvaluation', () => {
  it('returns one entry per profile with every check, all passing on the engine fixture library', () => {
    const profiles = edgeCaseProfiles();
    const entries = runEvaluation(profiles, library);
    expect(entries.map((e) => e.profileId)).toEqual(profiles.map((p) => p.id));
    for (const entry of entries) {
      expect(entry.checks.map((c) => c.id)).toEqual([...EVALUATION_CHECKS]);
      for (const check of entry.checks) expect(check.failures, `${entry.profileId} ${check.id}`).toEqual([]);
    }
    // The edge cases include requests nothing satisfies; they pass as a clear "too few" answer.
    const none = entries.find((e) => e.profileId === 'EDGE-16-date')!;
    expect(none.looks).toEqual([]);
    expect(none.limitedBy?.constraint).toBe('occasion');
  });

  it('rejects duplicate profile IDs', () => {
    const p = evaluationProfile('DUP', { occasion: 'everyday' });
    expect(() => runEvaluation([p, p], library)).toThrow(/Duplicate/);
  });

  it('summarises and reports by profile ID only, never profile values', () => {
    const profiles = [evaluationProfile('EVAL-001', { occasion: 'everyday' }, { likedColors: ['lavender'] })];
    const entries = runEvaluation(profiles, library);
    const summary = summarizeEvaluation(entries, library);
    expect(summary).toMatchObject({ profiles: 1, passed: 1, contentVersion: library.contentVersion });
    const report = formatEvaluationReport(entries, library);
    expect(report).toContain('| EVAL-001 |');
    expect(report).toContain(library.contentVersion);
    expect(report).not.toMatch(/lavender/i);
  });
});

describe('each check catches its defect', () => {
  const profile = evaluationProfile(
    'BROKEN',
    { occasion: 'everyday' },
    {
      likedColors: ['tan'],
      dislikedColors: ['rust'],
      fabricPreferences: { liked: [], avoided: ['silk'] },
      coveragePreferences: { minSleeveLength: 'full', minGarmentLength: null, minNecklineCoverage: null },
    },
  );
  const good = engine(profile);
  const failed = (result: EngineResult) =>
    Object.entries(checkResult(profile, result, library))
      .filter(([, failures]) => failures.length > 0)
      .map(([id]) => id);

  it('a correct result passes', () => {
    expect(good.looks.length).toBeGreaterThan(0);
    expect(failed(good)).toEqual([]);
  });

  it('outcome: too few looks without INSUFFICIENT_MATCHES', () => {
    const bad = clone(good);
    bad.looks = bad.looks.slice(0, 1);
    bad.limitedBy = undefined;
    bad.warnings = bad.warnings.filter((w) => w !== 'INSUFFICIENT_MATCHES');
    expect(failed(bad)).toContain('outcome');
  });

  it('hardConstraints: a disliked colour, an avoided fabric or short sleeves, even in an alternative', () => {
    const cases: [string, (spec: EngineResult['looks'][number]['slots'][number]['lookSpec']) => void][] = [
      ['colour', (s) => (s.colorId = 'rust')],
      ['fabric', (s) => (s.fabric = 'silk')],
      ['coverage', (s) => (s.sleeve = 'short')],
    ];
    for (const [name, breakIt] of cases) {
      const bad = clone(good);
      const top = bad.looks.find((l) => l.templateId === 'OUT-001')!.slots[0]!;
      breakIt(top.alternatives[0]?.lookSpec ?? top.lookSpec);
      expect(failed(bad), name).toContain('hardConstraints');
    }
  });

  it('hardConstraints: a category not offered to the department (a kurti for men)', () => {
    const men = { ...profile, profile: { ...profile.profile, department: 'men' as const } };
    expect(good.looks.some((l) => l.slots.some((s) => s.lookSpec.category === 'kurti'))).toBe(true);
    expect(checkResult(men, good, library).hardConstraints).toEqual(
      expect.arrayContaining([expect.stringContaining('not offered to department men')]),
    );
  });

  it('templateFidelity: a colour outside the palette in suggested mode', () => {
    const bad = clone(good);
    bad.looks[0]!.slots[0]!.lookSpec.colorId = 'teal';
    expect(failed(bad)).toContain('templateFidelity');
  });

  it('uniqueSignatures: a repeated combination signature', () => {
    const bad = clone(good);
    bad.looks[1]!.combinationSignature = bad.looks[0]!.combinationSignature;
    expect(failed(bad)).toContain('uniqueSignatures');
  });

  it('alternatives: a padded (repeated) alternative, or a missing ALTERNATIVES_LIMITED', () => {
    const padded = clone(good);
    const slot = padded.looks[0]!.slots[0]!;
    slot.alternatives.push({ ...slot.alternatives[0]!, lookSpec: { ...slot.lookSpec } });
    expect(failed(padded)).toContain('alternatives');

    const unflagged = clone(good);
    unflagged.looks[0]!.slots[0]!.alternatives = [];
    unflagged.warnings = unflagged.warnings.filter((w) => w !== 'ALTERNATIVES_LIMITED');
    expect(failed(unflagged)).toContain('alternatives');
  });

  it('explanationFidelity: a rule quoted but not referenced, or referenced but not quoted', () => {
    const quoted = clone(good);
    quoted.looks[0]!.explanation += ` ${library.getRule('STY-004')!.rationale}`;
    expect(failed(quoted)).toContain('explanationFidelity');

    const referenced = clone(good);
    referenced.looks[0]!.explanationRefs.ruleIds.push('STY-004');
    expect(failed(referenced)).toContain('explanationFidelity');
  });

  it('noProductData: a price field or a link', () => {
    const priced = clone(good);
    (priced.looks[0]!.slots[0] as unknown as Record<string, unknown>).productMatch = { price: 999 };
    expect(failed(priced)).toContain('noProductData');

    const linked = clone(good);
    linked.looks[0]!.slots[0]!.searchPhrase = 'https://example.com/kurti';
    expect(failed(linked)).toContain('noProductData');
  });

  it('inclusiveLanguage: a judgemental phrase in an explanation', () => {
    const bad = clone(good);
    bad.looks[0]!.explanation += ' It hides your hips.';
    expect(failed(bad)).toContain('inclusiveLanguage');
  });

  it('deterministic is checked by running the engine twice (see runEvaluation above)', () => {
    expect(runEvaluation([profile], library)[0]!.checks.find((c) => c.id === 'deterministic')!.passed).toBe(true);
  });
});

describe('profiles from JSON (the CLI and the #54 dataset)', () => {
  it('builds an engine profile from PUT /v1/profile fields; omitted fields stay empty', () => {
    const p = toEvaluationProfile({
      id: 'EVAL-002',
      request: { occasion: 'work' },
      profile: { department: null, likedColors: ['navy'], sizes: { shoes: { uk: 7 } } },
      signals: { undertone: 'warm' },
    });
    expect(p.request).toEqual({ occasion: 'work', paletteMode: 'suggested' });
    expect(p.profile.department).toBeNull();
    expect(p.profile.likedColors).toEqual(['navy']);
    expect(p.profile.sizes).toEqual({
      tops: null,
      bottoms: null,
      ethnicTops: null,
      ethnicSets: null,
      shoes: { uk: 7 },
    });
    expect(p.profile.dislikedColors).toEqual([]);
    expect(p.signals).toEqual({ undertone: 'warm', skinTone: null, bodyProportions: null });
  });

  it('rejects unknown fields and values, and fields that are not Stage 1 profile fields', () => {
    const base = { id: 'EVAL-003', request: { occasion: 'work' }, profile: { department: 'women' } };
    expect(evaluationProfileInputSchema.safeParse(base).success).toBe(true);
    for (const bad of [
      { ...base, id: 'has spaces' },
      { ...base, request: { occasion: 'brunch' } },
      { ...base, profile: { department: 'women', likedColors: ['not-a-colour'] } },
      { ...base, profile: { department: 'women', height: 170 } },
      { ...base, signals: { undertone: 'warm', photo: 'x' } },
      { ...base, name: 'A person' },
    ]) {
      expect(evaluationProfileInputSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
