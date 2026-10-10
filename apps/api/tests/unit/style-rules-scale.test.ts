import { OCCASION_IDS } from '@styleme/contracts';
import { describe, expect, it } from 'vitest';
import { buildCoverageReport, lintLibrary, loadStyleLibrary } from '../../src/style-rules';
import { buildFixtureLibrary } from '../fixtures/style-library';

// T-38 / AC-22: a synthetic library of 150 palettes and 150 templates loads, lints and indexes with
// no code changes. The generator half of T-38 (valid, diverse looks and their latency) is added with
// the generator (#11). Timings are printed so they can be recorded; the bound is only a regression
// guard, not a performance claim.

describe('T-38 style knowledge base at scale', () => {
  const raw = buildFixtureLibrary();

  it('lints 150 palettes and 150 templates without issues', () => {
    const result = lintLibrary(raw, { allowFixtures: true });
    expect(result.issues).toEqual([]);
    expect(result.approved.palettes).toHaveLength(150);
    expect(result.approved.templates).toHaveLength(150);
  });

  it('loads, indexes and answers template queries; records the time taken', () => {
    const started = performance.now();
    const library = loadStyleLibrary(raw, { allowFixtures: true, appEnv: 'local' });
    const loadMs = performance.now() - started;

    const queryStarted = performance.now();
    let found = 0;
    for (const occasion of OCCASION_IDS) {
      for (const department of ['women', 'men', 'any'] as const) {
        const templates = library.findTemplates({ occasion, department });
        expect(templates.length).toBeGreaterThan(0);
        found += templates.length;
      }
    }
    const queryMs = performance.now() - queryStarted;

    const report = buildCoverageReport(library);
    expect(report.counts.palettes).toBe(150);
    expect(report.counts.templates).toBe(150);

    console.info(
      `T-38: load+lint+index of ${library.counts.palettes} palettes, ${library.counts.templates} templates, ` +
        `${library.counts.stylingRules + library.counts.fabricRules} rules took ${loadMs.toFixed(1)} ms; ` +
        `${OCCASION_IDS.length * 3} template queries (${found} results) took ${queryMs.toFixed(2)} ms`,
    );
    expect(loadMs).toBeLessThan(5_000);
  });
});
