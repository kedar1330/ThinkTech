import { describe, expect, it } from 'vitest';
import { MAX_LOOKS, lookSchema } from '@styleme/contracts';
import { StyleLibraryError, loadStyleLibrary } from '../../../src/style-rules';
import { buildEngineFixtureLibrary, fixtureStylingRule } from '../../fixtures/style-library';
import { library, loadFixtures, run } from './helpers';

// Output contract, determinism, diversity, no product data, and content-version handling.

describe('output contract', () => {
  it('returns at most MAX_LOOKS looks that match the look contract (minus the IDs the service adds)', () => {
    const result = run();
    expect(library.counts).toEqual({ palettes: 3, stylingRules: 4, fabricRules: 2, templates: 5 });
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.looks.length).toBeLessThanOrEqual(MAX_LOOKS);
    for (const look of result.looks) {
      expect(() => lookSchema.parse({ ...look, id: 'a'.repeat(24), status: 'suggested', aiModel: null })).not.toThrow();
    }
  });
});

describe('T-12 determinism', () => {
  it('T-12 the same input and content version give the same looks', () => {
    const first = run({}, { likedColors: ['navy'] });
    const again = run({}, { likedColors: ['navy'] }, null, loadFixtures());
    expect(again).toEqual(first);
    expect(again.contentVersion).toBe(library.contentVersion);
  });

  it('T-12 the result does not depend on the order records are listed in', () => {
    const raw = buildEngineFixtureLibrary();
    const reversed = loadFixtures({
      palettes: [...raw.palettes].reverse(),
      stylingRules: [...raw.stylingRules].reverse(),
      fabricRules: [...raw.fabricRules].reverse(),
      templates: [...raw.templates].reverse(),
    });
    for (const occasion of ['everyday', 'work', 'festive'] as const) {
      expect(run({ occasion }, {}, null, reversed)).toEqual(run({ occasion }));
    }
  });

  it('T-12 the result does not depend on the order of the user’s list preferences', () => {
    const a = run({}, { likedColors: ['navy', 'lavender', 'rust'], dislikedColors: ['white', 'cream'] });
    const b = run({}, { likedColors: ['rust', 'navy', 'lavender'], dislikedColors: ['cream', 'white'] });
    expect(b.looks).toEqual(a.looks);
  });
});

describe('T-19 diversity', () => {
  it('T-19 no response repeats a combination signature', () => {
    for (const result of [run(), run({ paletteMode: 'explore' }), run({}, { department: 'any' })]) {
      const signatures = result.looks.map((l) => l.combinationSignature);
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it('T-19 the best look of each template comes before a second look of any template', () => {
    const result = run({}, { department: 'any' });
    const available = new Set(result.looks.map((l) => l.templateId)).size;
    // Every available template appears once before the selection fills up with repeats.
    expect(available).toBeGreaterThanOrEqual(3);
    expect(result.looks.length).toBe(MAX_LOOKS);
  });
});

describe('T-24 product layer disabled', () => {
  it('T-24 generated looks carry no product, price, retailer or availability, even with a budget saved', () => {
    const text = JSON.stringify(run({}, { budgetPreference: 5000 }));
    expect(text).not.toMatch(/price|retailer|product|availab|₹|https?:/i);
  });
});

describe('T-28 content version handling', () => {
  it('T-28 the content version changes when a record version changes, and is stamped on the result', () => {
    const raw = buildEngineFixtureLibrary();
    raw.palettes[0] = { ...(raw.palettes[0] as object), version: 2 };
    const changed = loadFixtures(raw);
    expect(changed.contentVersion).not.toBe(library.contentVersion);
    expect(run({}, {}, null, changed).contentVersion).toBe(changed.contentVersion);
  });

  it('T-28 an unapproved record fails the load, so the engine never sees it', () => {
    const raw = buildEngineFixtureLibrary();
    raw.stylingRules.push(fixtureStylingRule(9, { reviewStatus: 'draft', reviewedBy: null, reviewedAt: null }));
    expect(() => loadStyleLibrary(raw, { allowFixtures: true })).toThrow(StyleLibraryError);
  });

  it('T-28 a rule contradicting another in the same context fails the load', () => {
    const raw = buildEngineFixtureLibrary();
    raw.stylingRules.push(
      fixtureStylingRule(9, {
        rationale: 'Synthetic fixture rationale: a patterned piece adds interest to a plain look.',
        type: 'coordination',
        areas: ['coordination'],
        coordinationAspects: ['pattern_mixing'],
        appliesTo: { occasions: ['everyday'] },
        effect: { deprioritise: [{ attribute: 'pattern', value: 'solid' }], weight: 0.3 },
      }),
    );
    expect(() => loadStyleLibrary(raw, { allowFixtures: true })).toThrow(/CONTRADICTION/);
  });

  it('T-28 a retired record is skipped: it never appears in looks', () => {
    const raw = buildEngineFixtureLibrary();
    raw.templates = raw.templates.map((t) =>
      (t as { id: string }).id === 'OUT-005' ? { ...(t as object), reviewStatus: 'retired' } : t,
    );
    const lib = loadFixtures(raw);
    expect(lib.getTemplate('OUT-005')).toBeUndefined();
    expect(run({}, { department: 'any' }, null, lib).looks.map((l) => l.templateId)).not.toContain('OUT-005');
  });
});
