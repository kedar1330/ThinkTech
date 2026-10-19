import { describe, expect, it } from 'vitest';
import { OCCASION_IDS, recommendationRequestSchema } from '@styleme/contracts';
import {
  filterTemplates,
  resolvePreferences,
  runEvaluation,
  type EvaluationProfile,
} from '../../../src/services/engine';
import { loadStyleLibrary } from '../../../src/style-rules';
import { buildFixtureLibrary } from '../../fixtures/style-library';
import { buildProfile } from '../../fixtures/profiles';

// T-38, generator half (the loader half is style-rules-scale.test.ts): on the synthetic library of
// 150 palettes and 150 templates (never deployed), every occasion × department request returns valid,
// diverse looks that pass every evaluation check. Latency is printed so it can be recorded; the bound
// is only a regression guard, not a performance claim.

describe('T-38 generator at scale', () => {
  const library = loadStyleLibrary(buildFixtureLibrary(), { allowFixtures: true, appEnv: 'local' });
  const DEPARTMENTS = ['women', 'men', 'any', null] as const;
  const profiles: EvaluationProfile[] = OCCASION_IDS.flatMap((occasion) =>
    DEPARTMENTS.map((department) => ({
      id: `SCALE-${occasion}-${department ?? 'none'}`,
      request: recommendationRequestSchema.parse({ occasion }),
      profile: buildProfile({ department }),
      signals: null,
    })),
  );

  it('T-38 every occasion × department returns valid looks that pass every check; latency recorded', () => {
    const started = performance.now();
    const entries = runEvaluation(profiles, library);
    const totalMs = performance.now() - started;

    for (const entry of entries) {
      expect(entry.looks.length, entry.profileId).toBeGreaterThan(0);
      for (const check of entry.checks) expect(check.failures, `${entry.profileId} ${check.id}`).toEqual([]);
    }
    // Each profile runs the engine twice (the determinism check).
    const perRequestMs = totalMs / (profiles.length * 2);
    console.info(
      `T-38: ${profiles.length} requests (×2 for determinism) on ${library.counts.palettes} palettes and ` +
        `${library.counts.templates} templates took ${totalMs.toFixed(0)} ms, ${perRequestMs.toFixed(1)} ms per request`,
    );
    expect(perRequestMs).toBeLessThan(500);
  });

  it('T-38 looks are diverse: one look per template before any template repeats', () => {
    for (const { id, request, profile } of profiles) {
      const available = filterTemplates(library, request, resolvePreferences(profile, null)).templates.length;
      const entry = runEvaluation([{ id, request, profile, signals: null }], library)[0]!;
      const templates = new Set(entry.looks.map((l) => l.templateId)).size;
      expect(templates, id).toBe(Math.min(entry.looks.length, available));
    }
  });
});
