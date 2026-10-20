import { describe, expect, it } from 'vitest';
import { CATEGORIES, OCCASION_IDS, recommendationRequestSchema, type Occasion } from '@styleme/contracts';
import {
  listAllPalettes,
  rankPalettes,
  resolvePreferences,
  runEvaluation,
  summarizeEvaluation,
  type EngineResult,
  type EvaluationProfile,
  type StyleLibrary,
} from '../../../src/services/engine';
import { emptyProfile } from '../../../src/services/profile.service';
import { SHIPPED_LIBRARY, loadStyleLibrary } from '../../../src/style-rules';
import { buildProfile, edgeCaseProfiles } from '../../fixtures/profiles';
import { run } from './helpers';

// The founder-approved C0 library, loaded exactly as the API loads it at startup (no fixtures, no
// simulated approval): AC5 of #33 and AC-05 … AC-08 (MVP.md §5) for #34. Re-run on C1 (#35).

const c0 = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: 'production' });
const DEPARTMENTS = ['women', 'men', 'any', null] as const;
const look = (department: (typeof DEPARTMENTS)[number], occasion: Occasion, lib: StyleLibrary = c0) =>
  run({ occasion }, { department }, null, lib);

/** Every occasion × department, plus every edge-case profile on every occasion. */
const c0Profiles = (): EvaluationProfile[] => [
  ...OCCASION_IDS.flatMap((occasion) =>
    DEPARTMENTS.map((department) => ({
      id: `C0-${occasion}-${department ?? 'none'}`,
      request: recommendationRequestSchema.parse({ occasion }),
      profile: buildProfile({ department }),
      signals: null,
    })),
  ),
  ...OCCASION_IDS.flatMap((occasion) =>
    edgeCaseProfiles().map((p) => ({ ...p, id: `${p.id}-${occasion}`, request: { ...p.request, occasion } })),
  ),
];

describe('AC-05 … AC-08 on the approved C0 library', () => {
  const profiles = c0Profiles();
  const entries = runEvaluation(profiles, c0);
  const failures = (id: string) =>
    entries.flatMap((e) =>
      e.checks.filter((c) => c.id === id).flatMap((c) => c.failures.map((f) => `${e.profileId}: ${f}`)),
    );

  it('AC-05 every request returns at least one look, or a 200 with INSUFFICIENT_MATCHES naming the limit', () => {
    expect(failures('outcome')).toEqual([]);
    expect(failures('contract')).toEqual([]);
    // Every plain occasion × department request gets looks on C0.
    for (const e of entries.filter((x) => x.profileId.startsWith('C0-')))
      expect(e.looks.length, e.profileId).toBeGreaterThan(0);
  });

  it('AC-06 identical requests return identical looks', () => {
    expect(failures('deterministic')).toEqual([]);
  });

  it('AC-07 0 looks violate a hard constraint', () => {
    expect(failures('hardConstraints')).toEqual([]);
    expect(failures('templateFidelity')).toEqual([]);
  });

  it('AC-08 no repeated signature; alternatives 0–5 and ALTERNATIVES_LIMITED when fewer than 3', () => {
    expect(failures('uniqueSignatures')).toEqual([]);
    expect(failures('alternatives')).toEqual([]);
  });

  it('explanations are faithful, inclusive and carry no product data', () => {
    expect(failures('explanationFidelity')).toEqual([]);
    expect(failures('inclusiveLanguage')).toEqual([]);
    expect(failures('noProductData')).toEqual([]);
  });

  it('records the summary for #34', () => {
    const summary = summarizeEvaluation(entries, c0);
    console.info(
      `AC-05 … AC-08 on C0 (${summary.contentVersion}): ${summary.passed}/${summary.profiles} profiles pass every check, ` +
        `${summary.looks} looks, ${summary.withoutLooks} profiles with no looks`,
    );
    expect(summary.passed).toBe(summary.profiles);
  });
});

// AC5 (#33): regressions for the founder-review corrections and the rule effects.
describe('AC5: the approved C0 library in the shipped library', () => {
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

  it('holds the C0 and C1 records, every one founder-approved', () => {
    // C0 (#32): 8 · 8 · 6 · 8. C1 (#35) adds 8 palettes, 12 styling rules, 5 fabric rules, 13 templates.
    expect(c0.counts).toEqual({ palettes: 16, stylingRules: 20, fabricRules: 11, templates: 21 });
    const records = [...c0.palettes, ...c0.stylingRules, ...c0.fabricRules, ...c0.templates];
    for (const r of records) expect([r.reviewStatus, r.isFixture], r.id).toEqual(['approved', undefined]);
    for (const r of c0.fabricRules) expect(r.practicalityValidated, r.id).toBe(false);
  });

  it('every department and occasion: no metallic bottoms, and fabrics only from scoped fabric rules', () => {
    for (const department of DEPARTMENTS) {
      for (const occasion of OCCASION_IDS) {
        const where = `${department}/${occasion}`;
        for (const l of look(department, occasion).looks) {
          const template = c0.getTemplate(l.templateId)!;
          for (const slot of l.slots) {
            const templateSlot = template.slots.find((s) => s.slotId === slot.slotId)!;
            for (const spec of [slot.lookSpec, ...slot.alternatives.map((a) => a.lookSpec)]) {
              expect(CATEGORIES.find((c) => c.id === spec.category)!.slotType).toBe(slot.slot);
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
    }
  });

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
    expect(listAllPalettes(c0.palettes).map((p) => p.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `PAL-${String(i + 1).padStart(3, '0')}`),
    );
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
