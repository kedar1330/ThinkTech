import { describe, expect, it } from 'vitest';
import { COLOUR_CATEGORY_COUNT, colourCategoryId } from '@styleme/contracts';
import { deltaE, hexToOklch } from '../../src/colours/colour-math';
import { colourLibraryContentSchema } from '../../src/colours/content';
import { buildColourLibrary, colourFamily, masterColours } from '../../src/colours/library';
import { isAllowedColourName, sourceColours } from '../../src/colours/sources';
import { findJudgementalLanguage } from '../../src/style-rules/inclusive-language';
import shipped from '../../src/style-rules/data/colour-library.json' with { type: 'json' };

// Colour library (D-133): open-licence sources, deterministic colour-theory scoring, 100+ colours for each of
// the 40 Monk tone × undertone categories.

const content = colourLibraryContentSchema.parse(shipped);
const library = buildColourLibrary(content);
const byId = new Map(library.colours.map((c) => [c.colourId, c]));
const category = (tone: number, undertone: 'warm' | 'cool' | 'neutral' | 'olive') =>
  library.categories.find((c) => c.categoryId === colourCategoryId(tone, undertone))!;

describe('colour maths', () => {
  it('converts hex to OKLCH', () => {
    expect(hexToOklch('#FFFFFF')).toMatchObject({ l: expect.closeTo(1, 3), c: expect.closeTo(0, 3) });
    expect(hexToOklch('#000000').l).toBeCloseTo(0, 3);
    expect(hexToOklch('#FF0000').h).toBeCloseTo(29.2, 0);
    expect(hexToOklch('#0000FF').h).toBeCloseTo(264.1, 0);
  });

  it('sorts colours into families', () => {
    expect(colourFamily(hexToOklch('#000080'))).toBe('blue');
    expect(colourFamily(hexToOklch('#FFFFFF'))).toBe('black_white');
    expect(colourFamily(hexToOklch('#808080'))).toBe('grey');
    expect(colourFamily(hexToOklch('#8B4513'))).toBe('brown');
    expect(colourFamily(hexToOklch('#F5F5DC'))).toBe('beige');
    expect(colourFamily(hexToOklch('#FFC0CB'))).toBe('pink');
    expect(colourFamily(hexToOklch('#008080'))).toBe('teal');
    expect(colourFamily(hexToOklch('#800080'))).toBe('purple');
  });
});

describe('colour sources', () => {
  it('leaves out judgemental, bodily and "skin colour" names', () => {
    for (const name of ['ugly purple', 'baby poop green', 'puke', 'flesh', 'nude', 'light skin', 'dried blood', 'camo'])
      expect(isAllowedColourName(name), name).toBe(false);
    for (const name of ['dusty rose', 'teal', 'burnt sienna', 'royal blue'])
      expect(isAllowedColourName(name)).toBe(true);
    const names = sourceColours().map((c) => c.name.toLowerCase());
    expect(names.some((n) => /\b(?:flesh|nude|skin|ugly|puke|vomit|poop)\b/.test(n))).toBe(false);
    for (const n of names) expect(findJudgementalLanguage(n), n).toEqual([]);
  });

  it('builds one master list without duplicate names or near-identical colours', () => {
    const colours = masterColours();
    expect(colours.length).toBeGreaterThan(500);
    expect(new Set(colours.map((c) => c.name.toLowerCase())).size).toBe(colours.length);
    expect(colours.every((c, i) => c.colourId === `CLR-${String(i + 1).padStart(4, '0')}`)).toBe(true);
    for (let i = 0; i < colours.length; i++)
      for (let j = i + 1; j < colours.length; j++)
        expect(deltaE(colours[i]!.oklab, colours[j]!.oklab)).toBeGreaterThanOrEqual(0.015);
  });
});

describe('colour library', () => {
  it('has 40 categories, each with 100+ distinct ranked colours', () => {
    expect(library.categories).toHaveLength(COLOUR_CATEGORY_COUNT);
    for (const cat of library.categories) {
      expect(cat.colours.length, cat.categoryId).toBeGreaterThanOrEqual(100);
      expect(new Set(cat.colours.map((c) => c.colourId)).size).toBe(cat.colours.length);
      expect(cat.colours.map((c) => c.rank)).toEqual(cat.colours.map((_, i) => i + 1));
      expect(cat.colours.every((c) => c.score >= 0 && c.score <= 100 && byId.has(c.colourId))).toBe(true);
      // Spread across the spectrum: no family takes more than the cap.
      const families = new Map<string, number>();
      for (const c of cat.colours)
        families.set(byId.get(c.colourId)!.family, (families.get(byId.get(c.colourId)!.family) ?? 0) + 1);
      expect(Math.max(...families.values())).toBeLessThanOrEqual(content.familyCap);
      expect(families.size).toBeGreaterThanOrEqual(8);
    }
  });

  it('is deterministic', () => {
    expect(buildColourLibrary(content)).toEqual(library);
  });

  it('follows the undertone: warm categories lean warm, cool categories lean cool', () => {
    const lean = (tone: number, undertone: 'warm' | 'cool') => {
      const top = category(tone, undertone)
        .colours.slice(0, 40)
        .map((c) => byId.get(c.colourId)!.temperature);
      return top.filter((t) => t === 'warm').length - top.filter((t) => t === 'cool').length;
    };
    for (const tone of [1, 5, 10]) {
      expect(lean(tone, 'warm')).toBeGreaterThan(10);
      expect(lean(tone, 'cool')).toBeLessThan(-10);
    }
  });

  it('follows skin depth: deeper skin gets richer colours on average', () => {
    const chroma = (tone: number) => {
      const cats = (['warm', 'cool', 'neutral', 'olive'] as const).map((u) => category(tone, u));
      const all = cats.flatMap((c) => c.colours.slice(0, 40).map((x) => byId.get(x.colourId)!.oklch.c));
      return all.reduce((a, b) => a + b, 0) / all.length;
    };
    expect(chroma(10)).toBeGreaterThan(chroma(1));
  });

  it('explains every colour in inclusive language', () => {
    for (const cat of library.categories) {
      expect(findJudgementalLanguage(cat.rationale)).toEqual([]);
      for (const c of cat.colours) {
        expect(c.reasons.length).toBeGreaterThanOrEqual(2);
        for (const r of c.reasons) expect(findJudgementalLanguage(r), r).toEqual([]);
      }
    }
  });

  it('ships founder-approved content only', () => {
    expect(content.reviewStatus).toBe('approved');
    expect(() => colourLibraryContentSchema.parse({ ...shipped, reviewedBy: null, reviewedAt: null })).toThrow();
    expect(() => colourLibraryContentSchema.parse({ ...shipped, coloursPerCategory: 50 })).toThrow();
  });
});
