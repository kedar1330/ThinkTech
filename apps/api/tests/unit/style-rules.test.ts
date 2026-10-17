import { describe, expect, it } from 'vitest';
import {
  SHIPPED_LIBRARY,
  StyleLibrary,
  StyleLibraryError,
  buildCoverageReport,
  findJudgementalLanguage,
  formatCoverageReport,
  lintLibrary,
  loadStyleLibrary,
  type LintCode,
  type RawLibrary,
} from '../../src/style-rules';
import { fixtureFabricRule, fixturePalette, fixtureStylingRule, fixtureTemplate } from '../fixtures/style-library';

function library(parts: Partial<RawLibrary> = {}): RawLibrary {
  return { palettes: [], stylingRules: [], fabricRules: [], templates: [], ...parts };
}

// A small, valid library: two palettes, two rules, one fabric rule and three templates.
function smallLibrary(): RawLibrary {
  return library({
    palettes: [fixturePalette(1), fixturePalette(2)],
    stylingRules: [fixtureStylingRule(1), fixtureStylingRule(2)],
    fabricRules: [fixtureFabricRule(1)],
    templates: [
      fixtureTemplate(1, { paletteCount: 2, ruleCount: 2 }),
      fixtureTemplate(2, { paletteCount: 2, ruleCount: 2 }),
      fixtureTemplate(3, { paletteCount: 2, ruleCount: 2 }),
    ],
  });
}

function codes(raw: RawLibrary): LintCode[] {
  return lintLibrary(raw, { allowFixtures: true }).issues.map((i) => i.code);
}

describe('style-rule linter', () => {
  it('accepts a valid library', () => {
    expect(lintLibrary(smallLibrary(), { allowFixtures: true }).issues).toEqual([]);
  });

  it('the shipped library in src/style-rules/data is linter-clean', () => {
    expect(lintLibrary(SHIPPED_LIBRARY).issues).toEqual([]);
  });

  it('T-28: an unapproved record fails the lint and is never loaded', () => {
    const raw = smallLibrary();
    raw.palettes.push(fixturePalette(3, { reviewStatus: 'draft', reviewedBy: null, reviewedAt: null }));
    const result = lintLibrary(raw, { allowFixtures: true });
    expect(result.issues).toEqual([expect.objectContaining({ code: 'NOT_APPROVED', recordId: 'PAL-003' })]);
    expect(result.approved.palettes.map((p) => p.id)).not.toContain('PAL-003');
    expect(() => loadStyleLibrary(raw, { allowFixtures: true })).toThrow(StyleLibraryError);
  });

  it('T-28: contradictory rules in an overlapping context fail the lint', () => {
    const prefer = fixtureStylingRule(10, {
      appliesTo: { categories: ['kurta'] },
      effect: { prefer: [{ attribute: 'fit', value: 'slim' }], weight: 0.5 },
    });
    const avoid = fixtureStylingRule(11, {
      appliesTo: { occasions: ['festive'] },
      effect: { deprioritise: [{ attribute: 'fit', value: 'slim' }], weight: 0.5 },
    });
    expect(codes(library({ stylingRules: [prefer, avoid] }))).toEqual(['CONTRADICTION']);
    expect(() => loadStyleLibrary(library({ stylingRules: [prefer, avoid] }), { allowFixtures: true })).toThrow();
  });

  it('allows opposite effects in contexts that do not overlap, or when the conflict is declared', () => {
    const prefer = fixtureStylingRule(10, {
      appliesTo: { categories: ['kurta'] },
      effect: { prefer: [{ attribute: 'fit', value: 'slim' }], weight: 0.5 },
    });
    const elsewhere = fixtureStylingRule(11, {
      appliesTo: { categories: ['jeans'] },
      effect: { deprioritise: [{ attribute: 'fit', value: 'slim' }], weight: 0.5 },
    });
    expect(codes(library({ stylingRules: [prefer, elsewhere] }))).toEqual([]);

    const declared = fixtureStylingRule(12, {
      appliesTo: { categories: ['kurta'] },
      effect: { deprioritise: [{ attribute: 'fit', value: 'slim' }], weight: 0.3 },
      conflictsWith: ['STY-010'],
    });
    expect(codes(library({ stylingRules: [prefer, declared] }))).toEqual([]);
  });

  it('flags a rule that prefers and deprioritises the same value', () => {
    const rule = fixtureStylingRule(1, {
      effect: {
        prefer: [{ attribute: 'fit', value: 'slim' }],
        deprioritise: [{ attribute: 'fit', value: 'slim' }],
        weight: 0.5,
      },
    });
    expect(codes(library({ stylingRules: [rule] }))).toEqual(['CONTRADICTION']);
  });

  it('flags duplicate IDs and duplicate content', () => {
    expect(codes(library({ palettes: [fixturePalette(1), fixturePalette(1)] }))).toContain('DUPLICATE_ID');
    const copy = { ...fixturePalette(1), id: 'PAL-099', version: 3 };
    expect(codes(library({ palettes: [fixturePalette(1), copy] }))).toEqual(['DUPLICATE_RECORD']);
  });

  it('flags duplicate slotIds within a template (D-82)', () => {
    const template = fixtureTemplate(1, {
      department: 'women',
      slots: [
        { slotId: 'accessory', slot: 'accessory', categoryOptions: ['accessory'] },
        { slotId: 'accessory', slot: 'accessory', categoryOptions: ['accessory'] },
      ],
    });
    expect(codes(library({ templates: [template] }))).toEqual(['DUPLICATE_SLOT_ID']);
  });

  it('flags unknown and unapproved references', () => {
    const template = fixtureTemplate(1, { compatiblePalettes: ['PAL-404'], ruleRefs: ['STY-404', 'FAB-404'] });
    expect(codes(library({ templates: [template] }))).toEqual([
      'UNKNOWN_REFERENCE',
      'UNKNOWN_REFERENCE',
      'UNKNOWN_REFERENCE',
    ]);

    const rule = fixtureStylingRule(1, { conflictsWith: ['STY-404'] });
    expect(codes(library({ stylingRules: [rule] }))).toEqual(['UNKNOWN_REFERENCE']);

    const draft = fixturePalette(2, { reviewStatus: 'draft', reviewedBy: null, reviewedAt: null });
    const usesDraft = fixtureTemplate(1, { compatiblePalettes: ['PAL-002'] });
    expect(codes(library({ palettes: [draft], templates: [usesDraft] })).sort()).toEqual([
      'NOT_APPROVED',
      'UNKNOWN_REFERENCE',
    ]);

    const offPalette = fixturePalette(1, { combinations: [{ colors: ['white', 'navy'], contrastLevel: 'high' }] });
    expect(codes(library({ palettes: [offPalette] }))).toContain('UNKNOWN_REFERENCE');
  });

  it('flags categories that do not fit the slot type or department', () => {
    const wrongSlot = fixtureTemplate(1, {
      department: 'men',
      slots: [
        { slotId: 'top', slot: 'top', categoryOptions: ['jeans'] },
        { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'] },
      ],
    });
    expect(codes(library({ templates: [wrongSlot] }))).toEqual(['CATEGORY_MISMATCH']);

    const wrongDepartment = fixtureTemplate(2, {
      department: 'men',
      slots: [
        { slotId: 'outfit', slot: 'one_piece', categoryOptions: ['saree'] },
        { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'] },
      ],
    });
    expect(codes(library({ templates: [wrongDepartment] }))).toEqual(['CATEGORY_MISMATCH']);
  });

  it('rejects records without rationale or limitations, or approved without a reviewer', () => {
    expect(codes(library({ palettes: [fixturePalette(1, { rationale: '' })] }))).toEqual(['INVALID_SCHEMA']);
    expect(codes(library({ palettes: [fixturePalette(1, { limitations: undefined })] }))).toEqual(['INVALID_SCHEMA']);
    expect(codes(library({ palettes: [fixturePalette(1, { reviewedBy: null })] }))).toEqual(['INVALID_SCHEMA']);
  });

  it('rejects values outside the shared vocabulary', () => {
    expect(codes(library({ palettes: [fixturePalette(1, { occasions: ['brunch'] })] }))).toEqual(['INVALID_SCHEMA']);
    const rule = fixtureStylingRule(1, { effect: { prefer: [{ attribute: 'fit', value: 'baggy' }], weight: 0.5 } });
    expect(codes(library({ stylingRules: [rule] }))).toEqual(['INVALID_SCHEMA']);
    const forbid = fixtureStylingRule(2, { effect: { prefer: [{ attribute: 'fit', value: 'slim' }], weight: 0 } });
    expect(codes(library({ stylingRules: [forbid] }))).toEqual(['INVALID_SCHEMA']);
  });

  it('T-22 (knowledge base): a judgemental phrase in a rationale is rejected', () => {
    const rule = fixtureStylingRule(1, { rationale: 'Dark colours hide your problem areas and look slimmer.' });
    const issues = lintLibrary(library({ stylingRules: [rule] }), { allowFixtures: true }).issues;
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.code === 'JUDGEMENTAL_LANGUAGE')).toBe(true);
  });

  it('skips retired records without failing the lint', () => {
    const raw = library({ palettes: [fixturePalette(1), fixturePalette(2, { reviewStatus: 'retired' })] });
    const loaded = loadStyleLibrary(raw, { allowFixtures: true });
    expect(loaded.palettes.map((p) => p.id)).toEqual(['PAL-001']);
  });

  it('refuses fixture records in the shipped library, and fixture libraries in production', () => {
    expect(codes(library({ palettes: [fixturePalette(1)] }))).toEqual([]);
    expect(lintLibrary(library({ palettes: [fixturePalette(1)] })).issues.map((i) => i.code)).toEqual([
      'FIXTURE_RECORD',
    ]);
    expect(() => loadStyleLibrary(smallLibrary(), { allowFixtures: true, appEnv: 'production' })).toThrow(/T-29/);
  });
});

describe('inclusive-language check', () => {
  it('passes plain effect descriptions', () => {
    for (const text of [
      'A V-neck creates a longer vertical line.',
      'High contrast between top and bottom draws attention to the waist.',
      'Breathable cotton keeps you cool in humid weather.',
    ]) {
      expect(findJudgementalLanguage(text)).toEqual([]);
    }
  });

  it('flags judgemental phrases', () => {
    for (const text of [
      'This is unflattering on most people.',
      'Not for your body type.',
      'You should avoid horizontal stripes.',
      'Helps hide your tummy.',
      'Makes you look slimmer.',
      'Too dark for this colour.',
      'Objectively unsuitable for broad shoulders.',
    ]) {
      expect(findJudgementalLanguage(text).length, text).toBeGreaterThan(0);
    }
  });
});

describe('style library loader and indexes', () => {
  const lib = loadStyleLibrary(smallLibrary(), { allowFixtures: true });

  it('loads approved records and looks them up by ID', () => {
    expect(lib.counts).toEqual({ palettes: 2, stylingRules: 2, fabricRules: 1, templates: 3 });
    expect(lib.getPalette('PAL-001')?.id).toBe('PAL-001');
    expect(lib.getTemplate('OUT-002')?.id).toBe('OUT-002');
    expect(lib.getRule('FAB-001')?.id).toBe('FAB-001');
    expect(lib.getPalette('OUT-001')).toBeUndefined();
  });

  it('finds templates by occasion, style and department; department "any" templates serve everyone', () => {
    for (const template of lib.templates) {
      const occasion = template.occasions[0]!;
      const style = template.styles[0]!;
      expect(lib.findTemplates({ occasion, style, department: 'any' })).toContain(template);
      const others = template.department === 'women' ? 'men' : 'women';
      const visibleToOthers = lib.findTemplates({ occasion, style, department: others }).includes(template);
      expect(visibleToOthers).toBe(template.department === 'any');
    }
  });

  it('indexes rules by category, including rules for every category', () => {
    const general = new StyleLibrary({
      palettes: [],
      fabricRules: [],
      templates: [],
      stylingRules: [
        lintLibrary(library({ stylingRules: [fixtureStylingRule(1, { appliesTo: {} })] }), { allowFixtures: true })
          .approved.stylingRules[0]!,
      ],
    });
    expect(general.rulesForCategory('saree').map((r) => r.id)).toEqual(['STY-001']);
    const category = lib.stylingRules[0]!.appliesTo.categories[0]!;
    expect(lib.rulesForCategory(category).map((r) => r.id)).toContain(lib.stylingRules[0]!.id);
  });
});

describe('coverage report (FR-STY-11)', () => {
  it('counts cells and lists empty and thin ones', () => {
    const lib = loadStyleLibrary(smallLibrary(), { allowFixtures: true });
    const report = buildCoverageReport(lib);

    // Template 3 has department "any", so it counts for both women and men.
    const any = lib.templates.find((t) => t.department === 'any')!;
    const [occasion, style] = [any.occasions[0]!, any.styles[0]!];
    expect(report.templatesByCell.women[occasion][style]).toBeGreaterThanOrEqual(1);
    expect(report.templatesByCell.men[occasion][style]).toBeGreaterThanOrEqual(1);

    expect(report.categoriesBySlot.footwear).toEqual(['shoes']);
    expect(report.gaps.empty).toContain('categories for slot layer');
    expect(report.gaps.empty).toContain('rules: area budget');

    const markdown = formatCoverageReport(report);
    expect(markdown).toContain('# Style knowledge base coverage');
    expect(markdown).toContain('Approved records: 2 palettes · 3 templates');
  });

  it('labels a report that includes drafts, so it is never mistaken for the approved library', () => {
    const report = buildCoverageReport(loadStyleLibrary(smallLibrary(), { allowFixtures: true }));
    const markdown = formatCoverageReport(report, { includesDrafts: true });
    expect(markdown).toContain('awaiting founder approval');
    expect(markdown).toContain('Records (approved and draft): 2 palettes · 3 templates');
    expect(markdown).not.toContain('Approved records:');
  });
});
