import type { ColourPreference, CombinationHarmony, CombinationRole } from '@styleme/contracts';
import { bell, hueDistance, smoothstep } from './colour-math';

// Coordinating colours and curated combinations (#105) from one user's own colour category. Deterministic: the
// same colours, scores and liked / avoided choices always give the same result, so nothing here calls an AI
// provider. Avoided colours are dropped before anything is built; liked colours rank higher.
//
// Pair fit (0 – 1), from OKLCH hue distance and lightness difference:
//   one neutral and one colour  → neutral and accent (the further apart in lightness, the better)
//   hues up to 18° apart        → tonal (needs a clear lightness difference)
//   hues 18° – 55° apart        → analogous
//   hues 150° – 180° apart      → complementary
// Three-colour combinations: triadic (hues about 120° apart), split complementary (one hue and the two beside
// its opposite), and any two-colour harmony with a neutral base added.
// Score (0 – 100) = 50% harmony fit + 50% the colours' average match for the user's skin tone and undertone,
// plus a bonus for each liked colour.

/** Bump when the rules change, so stored combinations are rebuilt. */
export const COMBINATION_RULES_VERSION = 1;

const NEUTRAL_FAMILIES = new Set(['grey', 'black_white', 'beige']);
const NEUTRAL_CHROMA = 0.05;
const MIN_PAIR_FIT = 0.35;
const LIKED_BONUS = 5;
/** Per harmony, at most this many combinations, and each colour in at most `MAX_USES_PER_COLOUR` of them. */
const MAX_PER_HARMONY = 40;
const MAX_USES_PER_COLOUR = 4;
const MAX_MATCHES = 8;

export const COMBINATION_REASONS: Record<CombinationHarmony, string> = {
  neutral_accent: 'A neutral base lets one colour from your palette take the lead.',
  tonal: 'Lighter and deeper shades of one hue give an easy, polished look.',
  analogous: 'Neighbouring hues on the colour wheel blend smoothly together.',
  complementary: 'Opposite hues on the colour wheel make each other stand out.',
  split_complementary: 'One hue with the two beside its opposite: lively but balanced.',
  triadic: 'Three hues evenly spaced around the colour wheel: bold and balanced.',
};

export interface CombinationSource {
  colourId: string;
  family: string;
  oklch: { l: number; c: number; h: number };
  /** 0 – 100: the colour's match for the user's skin tone and undertone. */
  score: number;
  preference: ColourPreference | null;
}

export interface GeneratedCombination {
  combinationId: string;
  harmony: CombinationHarmony;
  colours: Array<{ colourId: string; role: CombinationRole }>;
  score: number;
  likedCount: number;
}

export interface GeneratedCombinations {
  combinations: GeneratedCombination[];
  coordinating: Array<{ colourId: string; matches: string[] }>;
}

function isNeutral(c: CombinationSource): boolean {
  return c.oklch.c < NEUTRAL_CHROMA || NEUTRAL_FAMILIES.has(c.family);
}

/** How well two colours go together, and why; null when they don't. Neutral pairs count only for matches. */
export function pairFit(
  a: CombinationSource,
  b: CombinationSource,
): { harmony: CombinationHarmony | null; fit: number } | null {
  const dL = Math.abs(a.oklch.l - b.oklch.l);
  const na = isNeutral(a);
  const nb = isNeutral(b);
  let result: { harmony: CombinationHarmony | null; fit: number };
  if (na && nb) {
    result = { harmony: null, fit: 0.6 * smoothstep(0.15, 0.4, dL) };
  } else if (na || nb) {
    result = { harmony: 'neutral_accent', fit: dL < 0.08 ? 0 : 0.6 + 0.4 * smoothstep(0.1, 0.35, dL) };
  } else {
    const hd = hueDistance(a.oklch.h, b.oklch.h);
    if (hd <= 18) result = { harmony: 'tonal', fit: bell(hd, 0, 12) * smoothstep(0.08, 0.25, dL) };
    else if (hd <= 55)
      result = { harmony: 'analogous', fit: bell(hd, 35, 12) * (0.6 + 0.4 * smoothstep(0.03, 0.15, dL)) };
    else if (hd >= 150) result = { harmony: 'complementary', fit: bell(hd, 180, 15) };
    else return null;
  }
  return result.fit >= MIN_PAIR_FIT ? result : null;
}

function combinationId(ids: string[]): string {
  return `CMB-${[...ids]
    .sort()
    .map((id) => id.replace('CLR-', ''))
    .join('-')}`;
}

/** Base is the calmest colour (lowest chroma), pop the brightest. */
function withRoles(colours: CombinationSource[]): Array<{ colourId: string; role: CombinationRole }> {
  const sorted = [...colours].sort((x, y) => x.oklch.c - y.oklch.c || x.colourId.localeCompare(y.colourId));
  const roles: CombinationRole[] = sorted.length === 2 ? ['base', 'accent'] : ['base', 'accent', 'pop'];
  return sorted.map((c, i) => ({ colourId: c.colourId, role: roles[i]! }));
}

function scored(harmony: CombinationHarmony, fit: number, colours: CombinationSource[]): GeneratedCombination {
  const likedCount = colours.filter((c) => c.preference === 'liked').length;
  const suitability = colours.reduce((n, c) => n + c.score, 0) / colours.length / 100;
  const score = Math.min(100, Math.round(100 * (0.5 * fit + 0.5 * suitability)) + LIKED_BONUS * likedCount);
  return {
    combinationId: combinationId(colours.map((c) => c.colourId)),
    harmony,
    colours: withRoles(colours),
    score,
    likedCount,
  };
}

function inRange(x: number, lo: number, hi: number): boolean {
  return x >= lo && x <= hi;
}

export function generateCombinations(source: CombinationSource[]): GeneratedCombinations {
  const colours = source.filter((c) => c.preference !== 'avoided').sort((x, y) => x.colourId.localeCompare(y.colourId));
  const chromatic = colours.filter((c) => !isNeutral(c));
  const neutrals = colours.filter(isNeutral);
  const candidates: GeneratedCombination[] = [];

  // Two colours, and the same with a neutral base added.
  for (let i = 0; i < colours.length; i++) {
    for (let j = i + 1; j < colours.length; j++) {
      const a = colours[i]!;
      const b = colours[j]!;
      const pair = pairFit(a, b);
      if (!pair?.harmony) continue;
      candidates.push(scored(pair.harmony, pair.fit, [a, b]));
      if (pair.harmony === 'neutral_accent') continue;
      let best: { base: CombinationSource; fit: number } | null = null;
      for (const n of neutrals) {
        const fa = pairFit(n, a)?.fit ?? 0;
        const fb = pairFit(n, b)?.fit ?? 0;
        const fit = Math.min(fa, fb);
        if (fit >= MIN_PAIR_FIT && (!best || fit > best.fit)) best = { base: n, fit };
      }
      if (best) candidates.push(scored(pair.harmony, (pair.fit + best.fit) / 2, [best.base, a, b]));
    }
  }

  // Three hues: triadic and split complementary.
  for (let i = 0; i < chromatic.length; i++) {
    for (let j = i + 1; j < chromatic.length; j++) {
      for (let k = j + 1; k < chromatic.length; k++) {
        const [a, b, c] = [chromatic[i]!, chromatic[j]!, chromatic[k]!];
        const trio = [a, b, c];
        const [ab, ac, bc] = [
          hueDistance(a.oklch.h, b.oklch.h),
          hueDistance(a.oklch.h, c.oklch.h),
          hueDistance(b.oklch.h, c.oklch.h),
        ];
        if (inRange(ab, 95, 145) && inRange(ac, 95, 145) && inRange(bc, 95, 145)) {
          const fit = (bell(ab, 120, 15) + bell(ac, 120, 15) + bell(bc, 120, 15)) / 3;
          if (fit >= MIN_PAIR_FIT) candidates.push(scored('triadic', fit, trio));
          continue;
        }
        // One hue (the key) with two neighbours 30° – 75° apart, both 135° – 170° from the key.
        const sides: Array<[number, number, number]> = [
          [bc, ab, ac],
          [ac, ab, bc],
          [ab, ac, bc],
        ];
        for (const [close, far1, far2] of sides) {
          if (inRange(close, 30, 75) && inRange(far1, 135, 170) && inRange(far2, 135, 170)) {
            const fit = (bell(far1, 152, 12) + bell(far2, 152, 12)) / 2;
            if (fit >= MIN_PAIR_FIT) candidates.push(scored('split_complementary', fit, trio));
            break;
          }
        }
      }
    }
  }

  // Best first, then a varied selection per harmony.
  candidates.sort((x, y) => y.score - x.score || x.combinationId.localeCompare(y.combinationId));
  const uses = new Map<string, number>();
  const perHarmony = new Map<CombinationHarmony, number>();
  const seen = new Set<string>();
  const combinations: GeneratedCombination[] = [];
  for (const c of candidates) {
    if (seen.has(c.combinationId)) continue;
    if ((perHarmony.get(c.harmony) ?? 0) >= MAX_PER_HARMONY) continue;
    const key = (id: string) => `${c.harmony}:${id}`;
    if (c.colours.some((col) => (uses.get(key(col.colourId)) ?? 0) >= MAX_USES_PER_COLOUR)) continue;
    seen.add(c.combinationId);
    perHarmony.set(c.harmony, (perHarmony.get(c.harmony) ?? 0) + 1);
    for (const col of c.colours) uses.set(key(col.colourId), (uses.get(key(col.colourId)) ?? 0) + 1);
    combinations.push(c);
  }

  // For each colour, the colours that go best with it.
  const coordinating = colours.map((a) => {
    const matches = colours
      .filter((b) => b.colourId !== a.colourId)
      .flatMap((b) => {
        const pair = pairFit(a, b);
        if (!pair) return [];
        const rank = pair.fit * (0.5 + b.score / 200) + (b.preference === 'liked' ? 0.1 : 0);
        return [{ colourId: b.colourId, rank }];
      })
      .sort((x, y) => y.rank - x.rank || x.colourId.localeCompare(y.colourId))
      .slice(0, MAX_MATCHES)
      .map((m) => m.colourId);
    return { colourId: a.colourId, matches };
  });

  return { combinations, coordinating };
}
