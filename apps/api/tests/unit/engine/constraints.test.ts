import { describe, expect, it } from 'vitest';
import { GARMENT_LENGTH_IDS, SLEEVE_LENGTH_IDS } from '@styleme/contracts';
import { signalsFromAppearance, templateWearType, type EngineResult } from '../../../src/services/engine';
import { emptyProfile } from '../../../src/services/profile.service';
import { library, run, SIGNAL, slotSpec, specs, templateIds, withRule } from './helpers';

// Hard constraints (T-13, T-14), filters, and the precedence order hard constraint > explicit
// preference > approved rule > appearance signal (FR-LOOK-08, T-15).

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

describe('T-13 / T-14 colours', () => {
  it('T-13 a disliked colour never appears in looks or alternatives, in either palette mode', () => {
    const disliked = ['navy', 'cream', 'rust', 'white'] as const;
    for (const paletteMode of ['suggested', 'explore'] as const) {
      const used = specs(run({ paletteMode }, { dislikedColors: [...disliked] })).map((s) => s.colorId);
      expect(used.length).toBeGreaterThan(0);
      for (const colour of disliked) expect(used).not.toContain(colour);
    }
  });

  it('T-13 a palette combination with a disliked colour is never the base of a look', () => {
    // PAL-002's navy/white combination is gone; looks still come from its other combinations.
    const result = run({}, { dislikedColors: ['navy'] });
    const pal2 = result.looks.filter((l) => l.paletteId === 'PAL-002');
    expect(pal2.length).toBeGreaterThan(0);
    for (const look of pal2) expect(look.slots.map((s) => s.lookSpec.colorId)).not.toContain('navy');
  });

  it('T-13 disliking every colour of a slot’s role removes the look and names the colours as the limit', () => {
    const result = run({ occasion: 'festive' }, { dislikedColors: ['ivory', 'gold'] });
    expect(result.looks).toEqual([]);
    expect(result.limitedBy?.constraint).toBe('dislikedColors');
  });

  it('T-14 suggested mode uses only the look’s palette colours', () => {
    for (const look of run().looks) {
      const palette = library.getPalette(look.paletteId)!;
      const own = new Set<string>([...palette.neutrals, ...palette.accents]);
      for (const slot of look.slots) expect(own.has(slot.lookSpec.colorId), slot.lookSpec.colorId).toBe(true);
    }
  });

  it('T-14 explore mode lets a liked colour from outside the palette appear', () => {
    const profile = { likedColors: ['teal' as const] };
    expect(specs(run({}, profile)).map((s) => s.colorId)).not.toContain('teal');
    expect(specs(run({ paletteMode: 'explore' }, profile)).map((s) => s.colorId)).toContain('teal');
  });

  it('T-14 explore mode still prefers palette colours when nothing else applies', () => {
    const explore = run({ paletteMode: 'explore' });
    for (const look of explore.looks) {
      const palette = library.getPalette(look.paletteId)!;
      const own = new Set<string>([...palette.neutrals, ...palette.accents]);
      for (const slot of look.slots) expect(own.has(slot.lookSpec.colorId), slot.lookSpec.colorId).toBe(true);
    }
  });

  it('liked colours are boosted', () => {
    const tops = slotSpec(run({}, { likedColors: ['lavender'] }), 'OUT-001', 'top');
    expect(tops.map((s) => s.colorId)).toContain('lavender');
  });
});

describe('fabric and coverage hard constraints', () => {
  it('T-15 an avoided fabric never appears, even when a rule prefers it', () => {
    expect(specs(run()).map((s) => s.fabric)).toContain('cotton');
    const avoided = run({}, { fabricPreferences: { liked: [], avoided: ['cotton'] } });
    expect(avoided.looks.length).toBeGreaterThan(0);
    expect(specs(avoided).map((s) => s.fabric)).not.toContain('cotton');
  });

  it('T-15 minimum coverage is a hard constraint on sleeves and garment length', () => {
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

  it('T-15 coverage is explained when it shaped the look', () => {
    const coverage = { minSleeveLength: 'full', minGarmentLength: null, minNecklineCoverage: null } as const;
    const look = run({}, { coveragePreferences: coverage }).looks.find((l) => l.templateId === 'OUT-001')!;
    expect(look.explanation).toContain('It keeps to your coverage preferences.');
    expect(look.explanationRefs.attributes).toContainEqual({ attribute: 'coverage', value: 'sleeve' });
  });

  it('claims no neckline when the user set a neckline minimum (no neckline-to-coverage mapping yet)', () => {
    expect(specs(run()).some((s) => s.neckline === 'collared')).toBe(true);
    const result = run(
      {},
      { coveragePreferences: { minSleeveLength: null, minGarmentLength: null, minNecklineCoverage: 'high' } },
    );
    expect(specs(result).every((s) => s.neckline === undefined)).toBe(true);
  });
});

describe('T-15 precedence: hard constraint > preference > rule > signal (FR-LOOK-08)', () => {
  const bottoms = (result: EngineResult) => slotSpec(result, 'OUT-001', 'bottom').map((s) => s.silhouette);

  it('T-15 an approved rule ranks options when nothing else applies', () => {
    expect(bottoms(run())).toEqual(expect.arrayContaining(['straight']));
    expect(bottoms(run())).not.toContain('tapered');
  });

  it('T-15 an explicit preference outranks a rule', () => {
    expect(new Set(bottoms(run({}, { silhouettePreferences: ['wide_leg'] })))).toEqual(new Set(['wide_leg']));
    const fabrics = specs(run({}, { fabricPreferences: { liked: ['linen'], avoided: [] } })).map((s) => s.fabric);
    expect(fabrics).toContain('linen');
  });

  it('T-15 a rule outranks an appearance signal', () => {
    // STY-002 (rule, traditional styles) prefers straight; STY-003 (signal) prefers tapered.
    expect(new Set(bottoms(run({}, {}, SIGNAL)))).toEqual(new Set(['straight']));
  });

  it('T-15 a signal applies where no rule does, and only while signals are passed in', () => {
    expect(new Set(bottoms(run({ style: 'casual' }, {}, SIGNAL)))).toEqual(new Set(['tapered']));
    expect(bottoms(run({ style: 'casual' }))).not.toContain('tapered');
  });

  it('T-15 a hard constraint outranks a preference: a liked, disliked colour stays out', () => {
    const used = specs(run({ paletteMode: 'explore' }, { likedColors: ['teal'], dislikedColors: ['teal'] }));
    expect(used.map((s) => s.colorId)).not.toContain('teal');
  });

  it('T-15 a hard constraint outranks a signal: coverage holds with signals on', () => {
    const coverage = { minSleeveLength: 'full', minGarmentLength: null, minNecklineCoverage: null } as const;
    for (const spec of specs(run({}, { coveragePreferences: coverage }, SIGNAL))) {
      if (spec.sleeve)
        expect(SLEEVE_LENGTH_IDS.indexOf(spec.sleeve)).toBeGreaterThanOrEqual(SLEEVE_LENGTH_IDS.indexOf('full'));
    }
  });

  it('T-15 rules are soft: an explicit preference still wins over a rule that deprioritises it', () => {
    const lowerWideLeg = withRule({
      rationale: 'Synthetic fixture rationale: a tapered line is a common everyday choice.',
      appliesTo: { categories: ['trousers'], occasions: ['work'] },
      effect: { deprioritise: [{ attribute: 'silhouette', value: 'wide_leg' }], weight: 1 },
    });
    // The rule lowers wide-leg but the user's explicit preference still wins (fit preferences override rules).
    const result = run({ occasion: 'work' }, { silhouettePreferences: ['wide_leg'] }, null, lowerWideLeg);
    expect(new Set(bottoms(result))).toEqual(new Set(['wide_leg']));
  });

  it('a colour-family rule on footwear and accessories is applied (as STY-005 does)', () => {
    const metallic = withRule({
      rationale: 'Synthetic fixture rationale: a metallic accessory picks up the shine of a festive drape.',
      type: 'coordination',
      areas: ['coordination'],
      coordinationAspects: ['footwear_accessory'],
      appliesTo: { categories: ['accessory'] },
      effect: { prefer: [{ attribute: 'colorFamily', value: 'metallic' }], weight: 1 },
    });
    const accessories = (lib: typeof library) =>
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
    expect(run({}, {}, null, high).looks[0]!.explanationRefs.ruleIds).toContain('STY-009');
    // The rule doesn't apply outside its occasion.
    expect(
      run({ occasion: 'work' }, {}, null, high).looks.some((l) => l.explanationRefs.ruleIds.includes('STY-009')),
    ).toBe(false);
  });
});

describe('T-10 signals switched off or cleared', () => {
  const attribute = <T>(value: T) => ({
    value,
    source: 'self_reported' as const,
    userConfirmed: true as const,
    confirmedAt: '',
    estimate: null,
  });
  const appearance = { skinTone: null, undertone: attribute('cool' as const), bodyProportions: null };

  it('T-10 signals are not passed to the engine while useInRecommendations is off', () => {
    expect(signalsFromAppearance({ ...appearance, useInRecommendations: false })).toBeNull();
    expect(signalsFromAppearance({ ...appearance, useInRecommendations: true })).toEqual({
      undertone: 'cool',
      skinTone: null,
      bodyProportions: null,
    });
  });

  it('T-10 cleared or "not sure" signals give the same looks as a profile without signals', () => {
    const none = run({ style: 'casual' });
    expect(run({ style: 'casual' }, {}, { undertone: 'not_sure', skinTone: null, bodyProportions: null })).toEqual(
      none,
    );
    expect(
      run({ style: 'casual' }, {}, { undertone: null, skinTone: null, bodyProportions: 'prefer_not_to_say' }),
    ).toEqual(none);
    expect(none.signalsUsed).toBe(false);
    expect(run({ style: 'casual' }, {}, SIGNAL).signalsUsed).toBe(true);
  });
});

describe('T-32 size notes', () => {
  const sizes = { ...emptyProfile().sizes, ethnicTops: { letter: 'M' as const }, shoes: { uk: 6 } };
  const notes = (signals: typeof SIGNAL | null) => {
    const look = run({}, { sizes }, signals).looks.find((l) => l.templateId === 'OUT-001')!;
    return Object.fromEntries(look.slots.map((s) => [s.slotId, s.sizeNote]));
  };

  it('T-32 size notes come from the saved sizes, or ask for one', () => {
    expect(notes(null)).toMatchObject({
      top: 'Your saved size: M',
      footwear: 'Your saved size: UK 6',
      bottom: 'Add your bottoms size in your profile',
    });
  });

  it('T-32 body proportions and other signals do not change a size note', () => {
    const withSignals = run({}, { sizes }, SIGNAL).looks.flatMap((l) =>
      l.slots.map((s) => [s.lookSpec.category, s.sizeNote] as const),
    );
    const without = run({}, { sizes }).looks.flatMap((l) =>
      l.slots.map((s) => [s.lookSpec.category, s.sizeNote] as const),
    );
    expect(new Map(withSignals)).toEqual(new Map(without));
  });
});
