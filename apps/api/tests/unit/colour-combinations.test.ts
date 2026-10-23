import { describe, expect, it } from 'vitest';
import { COLOUR_CATEGORY_COUNT, COMBINATION_HARMONIES } from '@styleme/contracts';
import { hexToOklch } from '../../src/colours/colour-math';
import {
  COMBINATION_REASONS,
  generateCombinations,
  pairFit,
  type CombinationSource,
} from '../../src/colours/combinations';
import { colourLibraryContentSchema } from '../../src/colours/content';
import { buildColourLibrary } from '../../src/colours/library';
import { findJudgementalLanguage } from '../../src/style-rules/inclusive-language';
import shipped from '../../src/style-rules/data/colour-library.json' with { type: 'json' };

// Coordinating colours and curated combinations (#105): deterministic, only from the user's own colours,
// never with an avoided colour, liked colours ranked higher.

const library = buildColourLibrary(colourLibraryContentSchema.parse(shipped));
const byId = new Map(library.colours.map((c) => [c.colourId, c]));

function sources(categoryId: string, prefs: Record<string, 'liked' | 'avoided'> = {}): CombinationSource[] {
  const cat = library.categories.find((c) => c.categoryId === categoryId)!;
  return cat.colours.map((c) => {
    const s = byId.get(c.colourId)!;
    return {
      colourId: s.colourId,
      family: s.family,
      oklch: s.oklch,
      score: c.score,
      preference: prefs[c.colourId] ?? null,
    };
  });
}

const colour = (colourId: string, hex: string, family = 'blue'): CombinationSource => ({
  colourId,
  family,
  oklch: hexToOklch(hex),
  score: 80,
  preference: null,
});

describe('pair fit', () => {
  it('names the harmony from hue and lightness', () => {
    const navy = colour('CLR-0001', '#1F2A55');
    const sky = colour('CLR-0002', '#9EC3F0');
    const white = colour('CLR-0003', '#FAFAFA', 'black_white');
    const gold = colour('CLR-0004', '#C9A227', 'yellow');
    expect(pairFit(navy, sky)?.harmony).toBe('tonal');
    expect(pairFit(white, navy)?.harmony).toBe('neutral_accent');
    expect(pairFit(navy, gold)?.harmony).toBe('complementary');
  });

  it('rejects colours too alike to tell apart', () => {
    expect(pairFit(colour('CLR-0001', '#1F2A55'), colour('CLR-0002', '#202B57'))).toBeNull();
  });
});

describe('curated combinations', () => {
  it('builds many varied combinations and matches for every category', () => {
    expect(library.categories).toHaveLength(COLOUR_CATEGORY_COUNT);
    for (const cat of library.categories) {
      const own = new Set(cat.colours.map((c) => c.colourId));
      const { combinations, coordinating } = generateCombinations(sources(cat.categoryId));
      expect(combinations.length, cat.categoryId).toBeGreaterThanOrEqual(100);
      expect(new Set(combinations.map((c) => c.harmony)).size, cat.categoryId).toBeGreaterThanOrEqual(4);
      expect(new Set(combinations.map((c) => c.combinationId)).size).toBe(combinations.length);
      for (const c of combinations) {
        expect(c.colours.length === 2 || c.colours.length === 3).toBe(true);
        expect(c.colours[0]!.role).toBe('base');
        expect(c.score).toBeGreaterThanOrEqual(0);
        expect(c.score).toBeLessThanOrEqual(100);
        for (const col of c.colours) expect(own.has(col.colourId)).toBe(true);
      }
      expect(coordinating).toHaveLength(own.size);
      expect(coordinating.every((c) => c.matches.length > 0 && !c.matches.includes(c.colourId))).toBe(true);
    }
  });

  it('is deterministic and sorted best first', () => {
    const a = generateCombinations(sources('monk-06-warm'));
    const b = generateCombinations([...sources('monk-06-warm')].reverse());
    expect(b).toEqual(a);
    const scores = a.combinations.map((c) => c.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });

  it('never uses an avoided colour and ranks liked colours higher', () => {
    const plain = generateCombinations(sources('monk-04-cool'));
    const avoided = plain.combinations[0]!.colours[0]!.colourId;
    const liked = plain.combinations.at(-1)!.colours[0]!.colourId;
    const result = generateCombinations(sources('monk-04-cool', { [avoided]: 'avoided', [liked]: 'liked' }));

    const used = result.combinations.flatMap((c) => c.colours.map((col) => col.colourId));
    expect(used).not.toContain(avoided);
    expect(result.coordinating.map((c) => c.colourId)).not.toContain(avoided);
    expect(result.coordinating.flatMap((c) => c.matches)).not.toContain(avoided);

    const withLiked = result.combinations.filter((c) => c.colours.some((col) => col.colourId === liked));
    expect(withLiked.length).toBeGreaterThan(0);
    expect(withLiked.every((c) => c.likedCount === 1)).toBe(true);
  });

  it('explains every harmony in plain, non-judgemental words', () => {
    for (const h of COMBINATION_HARMONIES) {
      const reason = COMBINATION_REASONS[h.id];
      expect(reason.length).toBeGreaterThan(10);
      expect(findJudgementalLanguage(reason), reason).toEqual([]);
    }
  });
});
