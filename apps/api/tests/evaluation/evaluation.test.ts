import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { OCCASION_IDS } from '@styleme/contracts';
import {
  EVALUATION_CHECKS,
  evaluationProfileInputSchema,
  runEvaluation,
  summarizeEvaluation,
  toEvaluationProfile,
  type EvaluationEntry,
  type EvaluationProfileInput,
} from '../../src/services/engine';
import { loadStyleLibrary } from '../../src/style-rules';
import { library as fixtureLibrary } from '../unit/engine/helpers';
import raw from './profiles/stage1.json';

// The Stage 1 evaluation set (#54, TESTING.md §6): 25 – 30 synthetic profiles through the engine, with
// every automated check required to pass. Relevance is judged by the founder (scripts/evaluate.ts
// --export-review / --import-review), not here.

const inputs: EvaluationProfileInput[] = z.array(evaluationProfileInputSchema).parse(raw);
const profiles = inputs.map(toEvaluationProfile);

/** Failed checks as `profile check: reason` lines, so a failure names what to fix. */
const failures = (entries: readonly EvaluationEntry[]) =>
  entries.flatMap((e) =>
    e.checks.filter((c) => !c.passed).flatMap((c) => c.failures.map((f) => `${e.profileId} ${c.id}: ${f}`)),
  );

describe('Stage 1 evaluation profiles', () => {
  it('has 25 – 30 synthetic profiles with unique IDs', () => {
    expect(profiles.length).toBeGreaterThanOrEqual(25);
    expect(profiles.length).toBeLessThanOrEqual(30);
    expect(new Set(profiles.map((p) => p.id)).size).toBe(profiles.length);
    for (const p of profiles) expect(p.id).toMatch(/^EVAL-\d{2}-[a-z0-9-]+$/);
  });

  it('covers what TESTING.md §6 asks for', () => {
    const occasions = new Set(inputs.map((p) => p.request.occasion));
    expect([...OCCASION_IDS].filter((o) => !occasions.has(o))).toEqual([]);

    const departments = new Set(inputs.map((p) => p.profile.department));
    for (const d of ['women', 'men', 'any', null]) expect(departments).toContain(d);

    const has = (pred: (p: EvaluationProfileInput) => boolean) => inputs.some(pred);
    expect(has((p) => Boolean(p.request.style))).toBe(true);
    expect(has((p) => Boolean(p.request.wearType?.length))).toBe(true);
    expect(has((p) => p.request.paletteMode === 'explore')).toBe(true);
    expect(has((p) => Boolean(p.profile.likedColors?.length))).toBe(true);
    expect(has((p) => Boolean(p.profile.dislikedColors?.length))).toBe(true);
    // Conflicting inputs: a colour both liked and disliked; a fabric both liked and avoided.
    expect(has((p) => (p.profile.likedColors ?? []).some((c) => p.profile.dislikedColors?.includes(c)))).toBe(true);
    expect(
      has((p) =>
        (p.profile.fabricPreferences?.liked ?? []).some((f) => p.profile.fabricPreferences?.avoided.includes(f)),
      ),
    ).toBe(true);
    // Missing inputs: an occasion and nothing else (parsing fills in the default palette mode).
    expect(
      has(
        (p) =>
          !p.request.style &&
          !p.request.wearType &&
          p.request.paletteMode === 'suggested' &&
          Object.keys(p.profile).length === 1 &&
          !p.signals,
      ),
    ).toBe(true);
    expect(has((p) => Boolean(p.profile.coveragePreferences))).toBe(true);
    // With and without self-reported signals.
    expect(has((p) => Boolean(p.signals))).toBe(true);
    expect(has((p) => !p.signals)).toBe(true);
  });
});

describe.each([
  ['the shipped, founder-approved library', loadStyleLibrary()],
  ['the synthetic engine fixture library', fixtureLibrary],
])('automated checks on %s', (_name, library) => {
  const entries = runEvaluation(profiles, library);

  it('pass at 100 % for every profile', () => {
    expect(failures(entries)).toEqual([]);
    const summary = summarizeEvaluation(entries, library);
    expect(summary.passed).toBe(profiles.length);
    for (const id of EVALUATION_CHECKS) expect(summary.checks[id]).toEqual({ passed: profiles.length, failed: 0 });
  });

  it('gives each profile looks, or none with INSUFFICIENT_MATCHES and the limit named', () => {
    for (const e of entries) {
      if (e.looks.length > 0) continue;
      expect(e.warnings).toContain('INSUFFICIENT_MATCHES');
      expect(e.limitedBy?.constraint).toBeTruthy();
    }
  });
});
