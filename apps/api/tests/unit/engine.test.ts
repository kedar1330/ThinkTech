import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  GARMENT_LENGTH_IDS,
  MAX_LOOKS,
  OCCASION_IDS,
  SLEEVE_LENGTH_IDS,
  lookSchema,
  paletteListResponseSchema,
  recommendationRequestSchema,
  type LookSpec,
  type Occasion,
  type ProfileResponse,
  type RecommendationRequest,
} from '@styleme/contracts';
import {
  MAX_ALTERNATIVES,
  MIN_ALTERNATIVES,
  generateLooks,
  listAllPalettes,
  rankPalettes,
  resolvePreferences,
  signalsFromAppearance,
  templateWearType,
  type EngineResult,
  type EngineSignals,
  type StyleLibrary,
} from '../../src/services/engine';
import { emptyProfile } from '../../src/services/profile.service';
import { SHIPPED_LIBRARY, findJudgementalLanguage, loadStyleLibrary } from '../../src/style-rules';
import { buildEngineFixtureLibrary, buildFixtureLibrary, fixtureStylingRule } from '../fixtures/style-library';

// Unit tests for the pure look engine and palette ranking (#33), on the synthetic engine fixture
// library. The full named suite T-12 … T-28 is #34; the cases here cover each engine step.

const fixtures = () => loadStyleLibrary(buildEngineFixtureLibrary(), { allowFixtures: true });
const library = fixtures();

function run(
  request: Partial<RecommendationRequest> = {},
  profile: Partial<ProfileResponse> = {},
  signals: EngineSignals | null = null,
  lib: StyleLibrary = library,
): EngineResult {
  return generateLooks({
    request: recommendationRequestSchema.parse({ occasion: 'everyday', ...request }),
    profile: { ...emptyProfile(), department: 'women', ...profile },
    signals,
    library: lib,
  });
}

/** Every look specification in a result: each slot and each of its alternatives. */
const specs = (result: EngineResult): LookSpec[] =>
  result.looks.flatMap((l) => l.slots.flatMap((s) => [s.lookSpec, ...s.alternatives.map((a) => a.lookSpec)]));
const templateIds = (result: EngineResult) => [...new Set(result.looks.map((l) => l.templateId))].sort();
const slotSpec = (result: EngineResult, templateId: string, slotId: string) =>
  result.looks
    .filter((l) => l.templateId === templateId)
    .map((l) => l.slots.find((s) => s.slotId === slotId)!.lookSpec);

const SIGNAL: EngineSignals = { undertone: null, skinTone: null, bodyProportions: 'hips_wider_than_shoulders' };

describe('look engine: output contract and determinism', () => {
  it('the engine fixture library is lint-clean', () => {
    expect(library.counts).toEqual({ palettes: 3, stylingRules: 4, fabricRules: 2, templates: 5 });
  });

  it('returns at most MAX_LOOKS looks that match the look contract (minus the IDs the service adds)', () => {
    const result = run();
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.looks.length).toBeLessThanOrEqual(MAX_LOOKS);
    for (const look of result.looks) {
      expect(() => lookSchema.parse({ ...look, id: 'a'.repeat(24), status: 'suggested', aiModel: null })).not.toThrow();
    }
  });

  it('T-12: the same input and content version give the same looks', () => {
    const first = run({}, { likedColors: ['navy'] });
    const again = run({}, { likedColors: ['navy'] }, null, fixtures());
    expect(again).toEqual(first);
    expect(again.contentVersion).toBe(library.contentVersion);
  });

  it('the content version changes when a record version changes', () => {
    const raw = buildEngineFixtureLibrary();
    raw.palettes[0] = { ...(raw.palettes[0] as object), version: 2 };
    expect(loadStyleLibrary(raw, { allowFixtures: true }).contentVersion).not.toBe(library.contentVersion);
  });

  it('T-19: no response repeats a combination signature', () => {
    for (const result of [run(), run({ paletteMode: 'explore' }), run({}, { department: 'any' })]) {
      const signatures = result.looks.map((l) => l.combinationSignature);
      expect(new Set(signatures).size).toBe(signatures.length);
    }
  });

  it('generated looks carry no product, price, retailer or availability (FR-LOOK-18, T-24)', () => {
    const text = JSON.stringify(run({}, { budgetPreference: 5000 }));
    expect(text).not.toMatch(/price|retailer|product|availab|₹|https?:/i);
  });
});

describe('filterTemplates: occasion, department, style and wear type', () => {
  it('uses the user’s department, plus department-neutral templates', () => {
    expect(templateIds(run())).toEqual(['OUT-001', 'OUT-002', 'OUT-005']);
    expect(templateIds(run({}, { department: 'men' }))).toEqual(['OUT-002', 'OUT-003', 'OUT-005']);
  });

  it('without a department gives general results across departments, flagged as a default', () => {
    const result = run({}, { department: null });
    expect(templateIds(result)).toEqual(['OUT-001', 'OUT-002', 'OUT-003', 'OUT-005']);
    expect(result.departmentFiltered).toBe(false);
    expect(result.defaultsApplied).toContain('department');
  });

  it('a requested style filters templates', () => {
    expect(templateIds(run({ style: 'classic' }))).toEqual(['OUT-002']);
  });

  it('a requested wear type is a hard filter (D-96)', () => {
    expect(templateIds(run({ wearType: ['western'] }))).toEqual(['OUT-002']);
    expect(templateIds(run({ wearType: ['indian', 'fusion'] }))).toEqual(['OUT-001', 'OUT-005']);
  });

  it('reads the wear type from the wear-* tag until the template field lands (#63)', () => {
    expect(templateWearType(library.getTemplate('OUT-005')!)).toBe('fusion');
  });

  it('offers only categories of the user’s department', () => {
    const categories = new Set(specs(run({}, { department: 'men' })).map((s) => s.category));
    expect(categories.has('kurti')).toBe(false);
  });
});

describe('fillSlots: colours and hard constraints', () => {
  it('T-13: a disliked colour never appears in looks or alternatives', () => {
    const disliked = ['navy', 'cream', 'rust', 'white'] as const;
    for (const paletteMode of ['suggested', 'explore'] as const) {
      const used = specs(run({ paletteMode }, { dislikedColors: [...disliked] })).map((s) => s.colorId);
      for (const colour of disliked) expect(used).not.toContain(colour);
    }
  });

  it('suggested mode uses only the look’s palette colours', () => {
    const result = run();
    for (const look of result.looks) {
      const palette = library.getPalette(look.paletteId)!;
      const own = new Set<string>([...palette.neutrals, ...palette.accents]);
      for (const slot of look.slots) expect(own.has(slot.lookSpec.colorId), slot.lookSpec.colorId).toBe(true);
    }
  });

  it('T-14: explore mode lets a liked colour from outside the palette appear', () => {
    const profile = { likedColors: ['teal' as const] };
    expect(specs(run({}, profile)).map((s) => s.colorId)).not.toContain('teal');
    expect(specs(run({ paletteMode: 'explore' }, profile)).map((s) => s.colorId)).toContain('teal');
  });

  it('liked colours are boosted', () => {
    const tops = slotSpec(run({}, { likedColors: ['lavender'] }), 'OUT-001', 'top');
    expect(tops.map((s) => s.colorId)).toContain('lavender');
  });

  it('an avoided fabric never appears, even when a rule prefers it', () => {
    expect(specs(run()).map((s) => s.fabric)).toContain('cotton');
    const avoided = run({}, { fabricPreferences: { liked: [], avoided: ['cotton'] } });
    expect(specs(avoided).map((s) => s.fabric)).not.toContain('cotton');
  });

  it('minimum coverage is a hard constraint on sleeves and garment length', () => {
    const result = run(
      {},
      { coveragePreferences: { minSleeveLength: 'full', minGarmentLength: 'knee', minNecklineCoverage: null } },
    );
    // The tee template only allows short or elbow sleeves, so it drops out.
    expect(templateIds(result)).not.toContain('OUT-005');
    const tops = specs(result).filter((s) => ['kurti', 'shirt', 't_shirt'].includes(s.category));
    expect(tops.length).toBeGreaterThan(0);
    for (const spec of tops) {
      expect(SLEEVE_LENGTH_IDS.indexOf(spec.sleeve!)).toBeGreaterThanOrEqual(SLEEVE_LENGTH_IDS.indexOf('full'));
      expect(GARMENT_LENGTH_IDS.indexOf(spec.length!)).toBeGreaterThanOrEqual(GARMENT_LENGTH_IDS.indexOf('knee'));
    }
  });

  it('claims no neckline when the user set a neckline minimum (no neckline-to-coverage mapping yet)', () => {
    expect(specs(run()).some((s) => s.neckline === 'collared')).toBe(true);
    const result = run(
      {},
      { coveragePreferences: { minSleeveLength: null, minGarmentLength: null, minNecklineCoverage: 'high' } },
    );
    expect(specs(result).every((s) => s.neckline === undefined)).toBe(true);
  });

  it('size notes come from the saved sizes, or ask for one', () => {
    const result = run({}, { sizes: { ...emptyProfile().sizes, ethnicTops: { letter: 'M' }, shoes: { uk: 6 } } });
    const look = result.looks.find((l) => l.templateId === 'OUT-001')!;
    const note = (slotId: string) => look.slots.find((s) => s.slotId === slotId)?.sizeNote;
    expect(note('top')).toBe('Your saved size: M');
    expect(note('footwear')).toBe('Your saved size: UK 6');
    expect(note('bottom')).toBe('Add your bottoms size in your profile');
  });
});

describe('applyRules and rank: precedence (FR-LOOK-08, T-15)', () => {
  const bottoms = (result: EngineResult) => slotSpec(result, 'OUT-001', 'bottom').map((s) => s.silhouette);

  it('an approved rule ranks options when nothing else applies', () => {
    expect(bottoms(run())).toEqual(expect.arrayContaining(['straight']));
    expect(bottoms(run())).not.toContain('tapered');
  });

  it('an explicit preference outranks a rule', () => {
    expect(new Set(bottoms(run({}, { silhouettePreferences: ['wide_leg'] })))).toEqual(new Set(['wide_leg']));
    const fabrics = specs(run({}, { fabricPreferences: { liked: ['linen'], avoided: [] } })).map((s) => s.fabric);
    expect(fabrics).toContain('linen');
  });

  it('a rule outranks an appearance signal', () => {
    // STY-002 (rule, traditional styles) prefers straight; STY-003 (signal) prefers tapered.
    expect(new Set(bottoms(run({}, {}, SIGNAL)))).toEqual(new Set(['straight']));
  });

  it('a signal applies where no rule does, and only while signals are passed in', () => {
    expect(new Set(bottoms(run({ style: 'casual' }, {}, SIGNAL)))).toEqual(new Set(['tapered']));
    expect(bottoms(run({ style: 'casual' }))).not.toContain('tapered');
  });

  const withRule = (overrides: Record<string, unknown>) => {
    const raw = buildEngineFixtureLibrary();
    raw.stylingRules.push(fixtureStylingRule(9, overrides));
    return loadStyleLibrary(raw, { allowFixtures: true });
  };

  it('a colour-family rule on footwear and accessories is applied (as STY-005 does)', () => {
    const metallic = withRule({
      rationale: 'Synthetic fixture rationale: a metallic accessory picks up the shine of a festive drape.',
      type: 'coordination',
      areas: ['coordination'],
      coordinationAspects: ['footwear_accessory'],
      appliesTo: { categories: ['accessory'] },
      effect: { prefer: [{ attribute: 'colorFamily', value: 'metallic' }], weight: 1 },
    });
    const accessories = (lib: StyleLibrary) =>
      run({ occasion: 'festive' }, {}, null, lib).looks.map((l) => l.slots.find((s) => s.slotId === 'accessory-1')!);
    expect(accessories(library).map((s) => s.lookSpec.colorId)).toContain('ivory');
    expect(accessories(metallic).every((s) => s.lookSpec.colorFamily === 'metallic')).toBe(true);
    const looks = run({ occasion: 'festive' }, {}, null, metallic).looks;
    expect(looks.every((l) => l.explanationRefs.ruleIds.includes('STY-009'))).toBe(true);
  });

  it('a contrast rule ranks looks by their palette combination (as STY-007 and STY-008 do)', () => {
    const high = withRule({
      rationale: 'Synthetic fixture rationale: a high-contrast pairing gives a crisp everyday look.',
      type: 'combination',
      areas: ['coordination'],
      coordinationAspects: ['colour'],
      appliesTo: { occasions: ['everyday'] },
      effect: { prefer: [{ attribute: 'contrast', value: 'high' }], weight: 1 },
    });
    expect(run().looks.some((l) => l.explanationRefs.ruleIds.includes('STY-009'))).toBe(false);
    const result = run({}, {}, null, high);
    expect(result.looks[0]!.explanationRefs.ruleIds).toContain('STY-009');
    // The rule doesn't apply outside its occasion.
    expect(
      run({ occasion: 'work' }, {}, null, high).looks.some((l) => l.explanationRefs.ruleIds.includes('STY-009')),
    ).toBe(false);
  });

  it('signals are not used while useInRecommendations is off', () => {
    const attribute = {
      value: 'cool' as const,
      source: 'self_reported' as const,
      userConfirmed: true as const,
      confirmedAt: '',
      estimate: null,
    };
    const appearance = { skinTone: null, undertone: attribute, bodyProportions: null };
    expect(signalsFromAppearance({ ...appearance, useInRecommendations: false })).toBeNull();
    expect(signalsFromAppearance({ ...appearance, useInRecommendations: true })).toEqual({
      undertone: 'cool',
      skinTone: null,
      bodyProportions: null,
    });
  });
});

describe('defaults, conflicts and limits', () => {
  it('T-16: only an occasion still returns looks and lists the defaults applied', () => {
    const result = run();
    expect(result.looks.length).toBeGreaterThan(0);
    expect(result.defaultsApplied).toEqual(['colors', 'signals', 'sizes', 'style']);
    expect(result.warnings).toContain('DEFAULTS_APPLIED');
  });

  it('T-17: a colour both liked and disliked is left out, reported and explained', () => {
    const result = run({}, { likedColors: ['navy'], dislikedColors: ['navy'] });
    expect(result.conflicts).toEqual([{ field: 'colors', value: 'navy' }]);
    expect(result.warnings).toContain('PREFERENCE_CONFLICT');
    expect(specs(result).map((s) => s.colorId)).not.toContain('navy');
    for (const look of result.looks)
      expect(look.explanation).toContain('Navy is in both your liked and disliked colours');
  });

  it('T-18: a restrictive request returns fewer looks, never padded, and names the limit', () => {
    const result = run({ wearType: ['indian'] }, { department: 'men' });
    expect(templateIds(result)).toEqual(['OUT-003']);
    expect(result.looks.length).toBeLessThan(MAX_LOOKS);
    expect(result.warnings).toContain('INSUFFICIENT_MATCHES');
    expect(result.limitedBy).toEqual({ constraint: 'wearType', suggestion: expect.any(String) });
  });

  it('names coverage when coverage removed the only template', () => {
    const raw = buildEngineFixtureLibrary();
    const teeOnly = loadStyleLibrary(
      { ...raw, templates: raw.templates.filter((t) => (t as { id: string }).id === 'OUT-005') },
      { allowFixtures: true },
    );
    const coverage = { minSleeveLength: 'full', minGarmentLength: null, minNecklineCoverage: null } as const;
    const result = run({}, { coveragePreferences: coverage }, null, teeOnly);
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('coverage');
  });

  it('an occasion with no approved templates returns no looks and says so', () => {
    const result = run({ occasion: 'date' });
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('occasion');
  });

  it('an empty library returns no looks without failing', () => {
    const empty = loadStyleLibrary({ palettes: [], stylingRules: [], fabricRules: [], templates: [] });
    const result = run({}, {}, null, empty);
    expect(result.looks).toEqual([]);
    expect(result.warnings).toContain('INSUFFICIENT_MATCHES');
  });
});

describe('alternatives, search phrases and explanations', () => {
  it('T-20: 0–5 distinct alternatives per slot, each different from the slot, never padded', () => {
    const result = run({ paletteMode: 'explore' });
    for (const slot of result.looks.flatMap((l) => l.slots)) {
      expect(slot.alternatives.length).toBeLessThanOrEqual(MAX_ALTERNATIVES);
      const keys = [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)].map((s) => JSON.stringify(s));
      expect(new Set(keys).size).toBe(keys.length);
    }
    const limited = run().looks.some((l) => l.slots.some((s) => s.alternatives.length < MIN_ALTERNATIVES));
    expect(run().warnings.includes('ALTERNATIVES_LIMITED')).toBe(limited);
  });

  it('T-23: search phrases are generic text built from the look specification', () => {
    for (const slot of run().looks.flatMap((l) => l.slots)) {
      expect(slot.searchPhrase).toMatch(/^[a-z -]+$/);
      expect(slot.searchPhrase).not.toMatch(/https?:|price|buy|shop|₹/i);
    }
    const kurti = run().looks.find((l) => l.templateId === 'OUT-001')!.slots[0]!;
    expect(kurti.searchPhrase.endsWith('kurti')).toBe(true);
  });

  it('T-21: an explanation quotes exactly the rules in its references', () => {
    const rules = [...library.stylingRules, ...library.fabricRules];
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

  it('explanations pass the inclusive-language check', () => {
    for (const look of run({}, {}, SIGNAL).looks) expect(findJudgementalLanguage(look.explanation)).toEqual([]);
  });
});

describe('palette ranking (GET /v1/style/palettes)', () => {
  const prefs = (profile: Partial<ProfileResponse>, signals: EngineSignals | null = null) =>
    resolvePreferences({ ...emptyProfile(), department: 'women', ...profile }, signals);

  it('view=all lists every approved palette by ID with nothing suggested', () => {
    const all = listAllPalettes(library.palettes);
    expect(all.map((p) => p.id)).toEqual(['PAL-001', 'PAL-002', 'PAL-003']);
    expect(all.every((p) => p.suggestedBecause.length === 0)).toBe(true);
    expect(() => paletteListResponseSchema.parse({ palettes: all })).not.toThrow();
  });

  it('ranks undertone and skin tone first, when signals are enabled', () => {
    const ranked = rankPalettes(
      library.palettes,
      prefs({ likedColors: ['rust'] }, { undertone: 'cool', skinTone: '3-4', bodyProportions: null }),
    );
    expect(ranked[0]).toMatchObject({ id: 'PAL-002', suggestedBecause: ['undertone', 'skinTone'] });
    // A liked colour is never excluded by a suggestion (FR-PAL-03).
    expect(ranked.map((p) => p.id)).toContain('PAL-001');
  });

  it('without signals, liked colours rank palettes', () => {
    const ranked = rankPalettes(library.palettes, prefs({ likedColors: ['emerald'] }));
    expect(ranked[0]).toMatchObject({ id: 'PAL-003', suggestedBecause: ['likedColors'] });
  });

  it('suggestions leave out palettes with a disliked colour; view=all still shows them', () => {
    expect(rankPalettes(library.palettes, prefs({ dislikedColors: ['gold'] })).map((p) => p.id)).not.toContain(
      'PAL-003',
    );
    expect(listAllPalettes(library.palettes).map((p) => p.id)).toContain('PAL-003');
  });
});

describe('scale and real content', () => {
  it('T-38 scale: the synthetic 150 + 150 library still returns at most 5 looks quickly', () => {
    const big = loadStyleLibrary(buildFixtureLibrary(), { allowFixtures: true });
    const started = performance.now();
    const result = run({ occasion: 'work' }, { department: 'any' }, null, big);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(result.looks.length).toBeLessThanOrEqual(MAX_LOOKS);
  });
});

// AC5 (#33): the engine on the founder-approved C0 library, loaded exactly as the API loads it at
// startup. No fixtures and no simulated approval.
describe('AC5: the approved C0 library in the shipped library', () => {
  const c0 = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: 'production' });
  const DEPARTMENTS = ['women', 'men', 'any', null] as const;
  const look = (department: (typeof DEPARTMENTS)[number], occasion: Occasion, lib: StyleLibrary = c0) =>
    run({ occasion }, { department }, null, lib);

  /** The shipped library without one rule (and template references to it), to measure that rule's effect. */
  const without = (ruleId: string) => {
    const keep = (records: unknown[]) => records.filter((r) => (r as { id: string }).id !== ruleId);
    return loadStyleLibrary({
      palettes: SHIPPED_LIBRARY.palettes,
      stylingRules: keep(SHIPPED_LIBRARY.stylingRules),
      fabricRules: keep(SHIPPED_LIBRARY.fabricRules),
      templates: SHIPPED_LIBRARY.templates.map((t) => {
        const template = t as { ruleRefs: string[] };
        return { ...template, ruleRefs: template.ruleRefs.filter((id) => id !== ruleId) };
      }),
    });
  };
  const outcome = (result: EngineResult) => result.looks.map((l) => [l.combinationSignature, l.slots]);

  it('holds all 30 C0 records, every one founder-approved', () => {
    expect(c0.counts).toEqual({ palettes: 8, stylingRules: 8, fabricRules: 6, templates: 8 });
    const records = [...c0.palettes, ...c0.stylingRules, ...c0.fabricRules, ...c0.templates];
    for (const r of records) expect([r.reviewStatus, r.isFixture], r.id).toEqual(['approved', undefined]);
    for (const r of c0.fabricRules) expect(r.practicalityValidated, r.id).toBe(false);
  });

  for (const department of DEPARTMENTS) {
    it(`department ${department ?? '(none)'}: every occasion returns valid, compatible looks`, () => {
      for (const occasion of OCCASION_IDS) {
        const where = `${department}/${occasion}`;
        const result = look(department, occasion);
        expect(result.looks.length, where).toBeGreaterThan(0);
        expect(result.looks.length, where).toBeLessThanOrEqual(MAX_LOOKS);
        expect(look(department, occasion), `${where} deterministic`).toEqual(result);
        for (const l of result.looks) {
          const template = c0.getTemplate(l.templateId)!;
          const palette = c0.getPalette(l.paletteId)!;
          expect(() =>
            lookSchema.parse({ ...l, id: 'a'.repeat(24), status: 'suggested', aiModel: null }),
          ).not.toThrow();
          expect(template.occasions, where).toContain(occasion);
          expect(template.compatiblePalettes, where).toContain(l.paletteId);
          for (const id of l.explanationRefs.ruleIds) expect(c0.getRule(id), id).toBeDefined();
          for (const slot of l.slots) {
            const templateSlot = template.slots.find((s) => s.slotId === slot.slotId)!;
            for (const spec of [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)]) {
              const category = CATEGORIES.find((c) => c.id === spec.category)!;
              expect(templateSlot.categoryOptions, where).toContain(spec.category);
              expect(category.slotType).toBe(slot.slot);
              if (department === 'women' || department === 'men') expect(category.departments).toContain(department);
              expect([...palette.neutrals, ...palette.accents], where).toContain(spec.colorId);
              // Regressions for the founder-review corrections: no metallic bottoms, and a fabric the
              // template doesn't fix comes only from a fabric rule scoped to that garment.
              if (slot.slot === 'bottom') expect(spec.colorFamily, `${where} ${slot.slotId}`).not.toBe('metallic');
              if (spec.fabric && !templateSlot.constraints.fabrics) {
                const rules = c0.fabricRules.filter((r) => r.fabric === spec.fabric);
                expect(
                  rules.some((r) => r.appliesTo.categories.includes(spec.category)),
                  `${where} ${spec.fabric} ${spec.category}`,
                ).toBe(true);
              }
            }
          }
        }
      }
    });
  }

  it('contrast rules change the looks: STY-007 for work, STY-008 for party and date', () => {
    const changed = (ruleId: string, occasions: Occasion[]) =>
      occasions.some((o) =>
        (['women', 'men', 'any'] as const).some(
          (d) => JSON.stringify(outcome(look(d, o))) !== JSON.stringify(outcome(look(d, o, without(ruleId)))),
        ),
      );
    expect(changed('STY-007', ['work'])).toBe(true);
    expect(changed('STY-008', ['party', 'date'])).toBe(true);
    // Outside their occasions they change nothing.
    expect(changed('STY-007', ['everyday', 'festive'])).toBe(false);
    expect(changed('STY-008', ['work', 'everyday'])).toBe(false);
  });

  it('the colour-family rule STY-005 changes footwear and accessories and is explained', () => {
    const before = look('women', 'festive');
    expect(JSON.stringify(outcome(before))).not.toBe(
      JSON.stringify(outcome(look('women', 'festive', without('STY-005')))),
    );
    expect(before.looks.some((l) => l.explanationRefs.ruleIds.includes('STY-005'))).toBe(true);
  });

  it('palette ranking serves the approved palettes', () => {
    expect(listAllPalettes(c0.palettes).map((p) => p.id)).toEqual([
      'PAL-001',
      'PAL-002',
      'PAL-003',
      'PAL-004',
      'PAL-005',
      'PAL-006',
      'PAL-007',
      'PAL-008',
    ]);
    const warm = rankPalettes(
      c0.palettes,
      resolvePreferences(emptyProfile(), { undertone: 'warm', skinTone: null, bodyProportions: null }),
    );
    expect(
      warm
        .slice(0, 2)
        .map((p) => p.id)
        .sort(),
    ).toEqual(['PAL-001', 'PAL-006']);
  });
});
