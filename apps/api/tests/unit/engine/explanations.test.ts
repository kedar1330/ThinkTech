import { describe, expect, it } from 'vitest';
import { MAX_ALTERNATIVES, MIN_ALTERNATIVES } from '../../../src/services/engine';
import { explain } from '../../../src/services/engine/explain';
import { StyleLibraryError, findJudgementalLanguage, loadStyleLibrary } from '../../../src/style-rules';
import { buildEngineFixtureLibrary } from '../../fixtures/style-library';
import { edgeCaseProfiles } from '../../fixtures/profiles';
import { generateLooks } from '../../../src/services/engine';
import { library, run, SIGNAL } from './helpers';

// Alternatives (T-20), explanation fidelity (T-21), inclusive language (T-22), search phrases (T-23)
// and template explanations without AI wording (T-25).

const allEdgeCaseLooks = () =>
  edgeCaseProfiles().flatMap((p) =>
    generateLooks({ request: p.request, profile: p.profile, signals: p.signals, library }).looks.map((look) => ({
      profileId: p.id,
      look,
    })),
  );

describe('T-20 alternatives', () => {
  it('T-20 0–5 distinct alternatives per slot, each different from the slot, never padded', () => {
    const result = run({ paletteMode: 'explore' });
    for (const slot of result.looks.flatMap((l) => l.slots)) {
      expect(slot.alternatives.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
      const keys = [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)].map((s) => JSON.stringify(s));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('T-20 ALTERNATIVES_LIMITED is set exactly when some slot has fewer than 3 alternatives', () => {
    for (const result of [run(), run({ paletteMode: 'explore' }), run({ occasion: 'festive' })]) {
      const limited = result.looks.some((l) => l.slots.some((s) => s.alternatives.length < MIN_ALTERNATIVES));
      expect(result.warnings.includes('ALTERNATIVES_LIMITED')).toBe(limited);
    }
  });

  it('T-20 explore mode widens alternatives to the full limit where the palette alone cannot', () => {
    const counts = (paletteMode: 'suggested' | 'explore') =>
      run({ paletteMode }).looks.flatMap((l) => l.slots.map((s) => s.alternatives.length));
    expect(Math.max(...counts('explore'))).toBe(MAX_ALTERNATIVES);
    expect(counts('explore').reduce((a, b) => a + b)).toBeGreaterThan(counts('suggested').reduce((a, b) => a + b));
  });

  it('T-20 alternatives respect the same hard constraints as the slot', () => {
    const result = run({ paletteMode: 'explore' }, { dislikedColors: ['teal', 'navy'] });
    const alternatives = result.looks.flatMap((l) => l.slots.flatMap((s) => s.alternatives.map((a) => a.lookSpec)));
    expect(alternatives.length).toBeGreaterThan(0);
    for (const spec of alternatives) expect(['teal', 'navy']).not.toContain(spec.colorId);
  });
});

describe('T-21 explanation fidelity', () => {
  const rules = [...library.stylingRules, ...library.fabricRules];

  it('T-21 an explanation quotes exactly the rules in its references', () => {
    for (const look of run({}, { likedColors: ['tan'] }).looks) {
      const quoted = rules.filter((r) => look.explanation.includes(r.rationale)).map((r) => r.id);
      expect(quoted.sort()).toEqual([...look.explanationRefs.ruleIds].sort());
      expect(look.explanationRefs.attributes).toEqual(
        expect.arrayContaining([
          { attribute: 'template', value: look.templateId },
          { attribute: 'palette', value: look.paletteId },
        ]),
      );
      const likedUsed = look.slots.some((s) => s.lookSpec.colorId === 'tan');
      expect(look.explanationRefs.attributes.some((a) => a.attribute === 'likedColor')).toBe(likedUsed);
      expect(look.explanation.includes('from your liked colours')).toBe(likedUsed);
    }
  });

  it('T-21 holds for every edge-case profile', () => {
    for (const { profileId, look } of allEdgeCaseLooks()) {
      const quoted = rules.filter((r) => look.explanation.includes(r.rationale)).map((r) => r.id);
      expect(quoted.sort(), profileId).toEqual([...look.explanationRefs.ruleIds].sort());
    }
  });

  it('T-21 signals are cited only when they were used', () => {
    const cited = (signals: typeof SIGNAL | null) =>
      run({ style: 'casual' }, {}, signals).looks.some((l) =>
        l.explanationRefs.attributes.some((a) => ['undertone', 'skinTone'].includes(a.attribute)),
      );
    expect(cited(null)).toBe(false);
    expect(cited({ undertone: 'cool', skinTone: '3-4', bodyProportions: null })).toBe(true);
  });

  it('T-21 a sentence that fails the inclusive-language check is dropped with its references', () => {
    const template = { ...library.getTemplate('OUT-001')!, name: 'A set that hides your hips' };
    const result = explain({
      template,
      palette: library.getPalette('PAL-001')!,
      occasion: 'everyday',
      matched: [{ attribute: 'likedColor', value: 'rust' }],
      supporting: new Map([['STY-002', 0.4]]),
      conflicts: [],
      library,
    });
    expect(result.explanation).not.toContain('hides');
    expect(result.explanationRefs.attributes.map((a) => a.attribute)).not.toContain('template');
    expect(result.explanationRefs.attributes).toContainEqual({ attribute: 'likedColor', value: 'rust' });
    expect(result.explanationRefs.ruleIds).toEqual(['STY-002']);
  });
});

describe('T-22 inclusive language', () => {
  it('T-22 a judgemental phrase injected into a rule rationale is rejected and the library never loads', () => {
    const raw = buildEngineFixtureLibrary();
    raw.stylingRules[1] = {
      ...(raw.stylingRules[1] as object),
      rationale: 'Synthetic fixture rationale: straight trousers hide your problem areas.',
    };
    expect(() => loadStyleLibrary(raw, { allowFixtures: true })).toThrow(StyleLibraryError);
    try {
      loadStyleLibrary(raw, { allowFixtures: true });
    } catch (error) {
      expect((error as StyleLibraryError).issues.map((i) => i.code)).toContain('JUDGEMENTAL_LANGUAGE');
    }
  });

  it('T-22 every explanation for every edge-case profile passes the inclusive-language check', () => {
    const looks = allEdgeCaseLooks();
    expect(looks.length).toBeGreaterThan(0);
    for (const { profileId, look } of looks) expect(findJudgementalLanguage(look.explanation), profileId).toEqual([]);
  });
});

describe('T-23 search phrases', () => {
  it('T-23 search phrases are generic text built from the look specification', () => {
    for (const slot of run().looks.flatMap((l) => l.slots)) {
      expect(slot.searchPhrase).toMatch(/^[a-z -]+$/);
      expect(slot.searchPhrase).not.toMatch(/https?:|price|buy|shop|₹/i);
    }
    const kurti = run().looks.find((l) => l.templateId === 'OUT-001')!.slots[0]!;
    expect(kurti.searchPhrase.endsWith('kurti')).toBe(true);
  });

  it('T-23 every alternative has its own generic search phrase', () => {
    for (const slot of run({ paletteMode: 'explore' }).looks.flatMap((l) => l.slots)) {
      for (const alternative of slot.alternatives) {
        expect(alternative.searchPhrase).toMatch(/^[a-z -]+$/);
        expect(alternative.searchPhrase).not.toBe(slot.searchPhrase);
      }
    }
  });
});

describe('T-25 template explanations (AI wording off by default, D-67)', () => {
  it('T-25 with no AI wording, every look is complete with a template explanation', () => {
    for (const { profileId, look } of allEdgeCaseLooks()) {
      expect(look.explanation.length, profileId).toBeGreaterThan(0);
      expect(look.explanationRefs.attributes.length, profileId).toBeGreaterThan(0);
      for (const slot of look.slots) {
        expect(slot.searchPhrase.length).toBeGreaterThan(0);
        expect(slot.sizeNote.length).toBeGreaterThan(0);
        expect(slot.swatches.length).toBeGreaterThan(0);
      }
    }
  });

  // T-26 and T-27 with AI wording on need the optional AI wording step; they are added with it (#55).
});
