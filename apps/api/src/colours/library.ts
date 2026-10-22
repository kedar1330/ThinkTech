import {
  LIBRARY_UNDERTONES,
  MONK_TONES,
  colourCategoryId,
  skinDepthGroup,
  type ColourCategoryId,
  type ColourDepth,
  type ColourFamily,
  type ColourIntensity,
  type ColourSource,
  type ColourTemperature,
  type LibraryUndertone,
} from '@styleme/contracts';
import {
  bell,
  deltaE,
  hexToOklab,
  hexToRgb,
  hueDistance,
  oklabToOklch,
  smoothstep,
  type Oklab,
  type Oklch,
} from './colour-math';
import type { ColourLibraryContent, UndertoneContent } from './content';
import { sourceColours } from './sources';

// Builds the colour library (D-133): one master list of named colours, and for each of the 40 skin tone ×
// undertone categories the best-matching `coloursPerCategory` colours with a score and reasons. Deterministic:
// the same sources and content always give the same library, so nothing here calls an AI provider.
//
// Score (0 – 100) = 60% undertone fit + 40% skin-depth fit.
//   Undertone fit: closeness of the colour's OKLCH hue to the hues the undertone leans towards (from the
//   reviewed content), blended with a near-neutral score for low-chroma colours, times an intensity
//   preference (warm and cool: clearer colours; neutral and olive: softened, muted colours).
//   Skin-depth fit: intensity close to the ideal for the Monk tone (deeper skin → richer colours) and
//   contrast with the Monk swatch (colours that blend into the skin rank lower).

/** Colours closer than this in OKLab are treated as the same colour; the first name wins. */
const DUPLICATE_DELTA_E = 0.015;
const HUE_SPREAD = 24;

export interface LibraryColour {
  colourId: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
  oklab: Oklab;
  oklch: Oklch;
  family: ColourFamily;
  temperature: ColourTemperature;
  depth: ColourDepth;
  intensity: ColourIntensity;
  source: ColourSource;
}

export interface CategoryColour {
  colourId: string;
  score: number;
  rank: number;
  reasons: string[];
}

export interface LibraryCategory {
  categoryId: ColourCategoryId;
  monkTone: number;
  undertone: LibraryUndertone;
  label: string;
  skinHex: string;
  rationale: string;
  limitations: string;
  colours: CategoryColour[];
}

export interface ColourLibrary {
  colours: LibraryColour[];
  categories: LibraryCategory[];
}

// --- Describing colours -----------------------------------------------------------------------------------

export function colourFamily({ l, c, h }: Oklch): ColourFamily {
  if (c < 0.03) return l > 0.93 || l < 0.22 ? 'black_white' : 'grey';
  if (h >= 40 && h < 110 && c < 0.09 && l >= 0.62) return 'beige';
  if (h >= 20 && h < 110 && l < 0.62 && c < 0.17) return 'brown';
  if (h >= 345 || h < 15) return l >= 0.6 ? 'pink' : 'red';
  if (h < 40) return l >= 0.78 ? 'pink' : 'red';
  if (h < 75) return 'orange';
  if (h < 115) return 'yellow';
  if (h < 172) return 'green';
  if (h < 215) return 'teal';
  if (h < 278) return 'blue';
  return l >= 0.72 && h >= 320 ? 'pink' : 'purple';
}

/** Yellow-orange (positive) versus blue (negative) lean of a hue, about −1 … +1. */
function warmth(h: number): number {
  const rad = (h * Math.PI) / 180;
  return Math.sin(rad) - 0.35 * Math.max(0, -Math.cos(rad));
}

export function colourTemperature({ c, h }: Oklch): ColourTemperature {
  if (c < 0.03) return 'neutral';
  const w = warmth(h);
  return w > 0.3 ? 'warm' : w < -0.3 ? 'cool' : 'neutral';
}

export function colourDepth({ l }: Oklch): ColourDepth {
  return l >= 0.75 ? 'light' : l < 0.45 ? 'deep' : 'medium';
}

export function colourIntensity({ c }: Oklch): ColourIntensity {
  return c < 0.06 ? 'soft' : c < 0.14 ? 'medium' : 'bright';
}

/** The master list: allowed source colours, near-duplicates removed, numbered in source order. */
export function masterColours(): LibraryColour[] {
  const kept: LibraryColour[] = [];
  const names = new Set<string>();
  for (const s of sourceColours()) {
    const key = s.name.toLowerCase();
    if (names.has(key)) continue;
    const oklab = hexToOklab(s.hex);
    if (kept.some((k) => deltaE(k.oklab, oklab) < DUPLICATE_DELTA_E)) continue;
    const oklch = oklabToOklch(oklab);
    names.add(key);
    kept.push({
      colourId: `CLR-${String(kept.length + 1).padStart(4, '0')}`,
      name: s.name,
      hex: s.hex,
      rgb: hexToRgb(s.hex),
      oklab,
      oklch,
      family: colourFamily(oklch),
      temperature: colourTemperature(oklch),
      depth: colourDepth(oklch),
      intensity: colourIntensity(oklch),
      source: s.source,
    });
  }
  return kept;
}

// --- Scoring ----------------------------------------------------------------------------------------------

interface UndertoneFit {
  score: number;
  note: string;
}

/** Near-neutral colours (white, grey, black, cream …): which undertones they sit with. */
function nearNeutralScore(undertone: LibraryUndertone, { l, b }: Oklab): number {
  const cast = Math.max(-1, Math.min(1, b / 0.03)); // + warm (yellow) cast, − cool (blue) cast
  const white = l > 0.97;
  const black = l < 0.2;
  switch (undertone) {
    case 'warm':
      return white ? 0.45 : black ? 0.55 : 0.6 + 0.3 * cast;
    case 'cool':
      return white ? 0.9 : black ? 0.95 : 0.7 - 0.25 * cast;
    case 'neutral':
      return white ? 0.8 : 0.85;
    case 'olive':
      return white ? 0.55 : black ? 0.8 : 0.65 + 0.15 * cast;
  }
}

/** How each undertone prefers intensity and lightness (0.65 – 1). */
function intensityPreference(undertone: LibraryUndertone, { l, c }: Oklch): number {
  switch (undertone) {
    case 'warm':
      return 0.7 + 0.3 * bell(c, 0.13, 0.08);
    case 'cool':
      return 0.7 + 0.3 * Math.max(bell(c, 0.16, 0.09), l > 0.85 ? 0.9 : 0);
    case 'neutral':
      return 0.65 + 0.35 * bell(c, 0.09, 0.06);
    case 'olive':
      return (0.65 + 0.35 * bell(c, 0.09, 0.06)) * (0.75 + 0.25 * bell(l, 0.5, 0.2));
  }
}

export function undertoneFit(
  undertone: LibraryUndertone,
  rules: UndertoneContent,
  colour: LibraryColour,
): UndertoneFit {
  const { c, h } = colour.oklch;
  let best = { score: -1, note: '' };
  for (const centre of rules.hues) {
    const s = centre.weight * bell(hueDistance(h, centre.hue), 0, HUE_SPREAD);
    if (s > best.score) best = { score: s, note: centre.note };
  }
  const hueScore = Math.max(best.score, rules.baseHueScore);
  // Hue means little for low-chroma colours: blend towards the near-neutral score.
  const k = smoothstep(0.02, 0.07, c);
  const neutral = nearNeutralScore(undertone, colour.oklab);
  const score = (k * hueScore + (1 - k) * neutral) * intensityPreference(undertone, colour.oklch);
  return { score, note: k >= 0.5 ? best.note : rules.neutralNote };
}

export interface DepthFit {
  score: number;
  contrast: number;
}

export function depthFit(monkTone: number, skin: Oklab, colour: LibraryColour): DepthFit {
  const t = (monkTone - 1) / 9;
  const { c } = colour.oklch;
  const idealChroma = 0.06 + 0.1 * t;
  let chromaFit = c < 0.03 ? 0.8 : bell(c, idealChroma, 0.08);
  // Neon brights are toned down for lighter skin.
  if (c > 0.22) chromaFit *= 1 - 0.4 * (1 - t);
  const contrast = deltaE(colour.oklab, skin);
  return { score: 0.55 * chromaFit + 0.45 * smoothstep(0.05, 0.22, contrast), contrast };
}

function depthReasons(monkTone: number, colour: LibraryColour, contrast: number): string[] {
  const { l, c } = colour.oklch;
  const reasons = [
    contrast >= 0.3
      ? `Clear contrast against Monk ${monkTone} skin.`
      : contrast >= 0.15
        ? `Balanced contrast against Monk ${monkTone} skin.`
        : `Gentle, low contrast against Monk ${monkTone} skin; a lighter or deeper piece next to it adds definition.`,
  ];
  const group = skinDepthGroup(monkTone);
  if (group === 'deep' && c >= 0.12) reasons.push('A rich colour that holds its own against deeper skin.');
  else if (group === 'light' && l < 0.4) reasons.push('A deep shade that gives definition against lighter skin.');
  else if (group === 'light' && c < 0.1) reasons.push('A soft intensity that keeps the look gentle on lighter skin.');
  else if (group === 'medium' && c >= 0.08 && c <= 0.18)
    reasons.push('A medium-to-rich intensity that sits well with medium skin.');
  return reasons;
}

// --- Building ---------------------------------------------------------------------------------------------

/** Each colour already taken from a family lowers the next one's priority by this many points, up to the max. */
const FAMILY_REPEAT_PENALTY = 1.5;
const FAMILY_REPEAT_PENALTY_MAX = 9;

/**
 * Picks `count` colours, best first, with at most `familyCap` per family, and orders them so the top of the
 * list spans several families: each pick takes the highest score minus a small penalty per colour already
 * taken from that family. The stored score stays the colour's own.
 */
function pick(scored: Array<CategoryColour & { family: ColourFamily }>, count: number, familyCap: number) {
  const remaining = [...scored];
  const chosen: typeof scored = [];
  const perFamily = new Map<ColourFamily, number>();
  const priority = (s: (typeof scored)[number]) => {
    const n = perFamily.get(s.family) ?? 0;
    return n >= familyCap ? -Infinity : s.score - Math.min(FAMILY_REPEAT_PENALTY * n, FAMILY_REPEAT_PENALTY_MAX);
  };
  while (chosen.length < count && remaining.length > 0) {
    let best = 0;
    for (let i = 1; i < remaining.length; i++) if (priority(remaining[i]!) > priority(remaining[best]!)) best = i;
    // Every family at its cap: take the rest in score order.
    const [next] = remaining.splice(priority(remaining[best]!) === -Infinity ? 0 : best, 1);
    perFamily.set(next!.family, (perFamily.get(next!.family) ?? 0) + 1);
    chosen.push(next!);
  }
  return chosen;
}

export function buildColourLibrary(content: ColourLibraryContent, colours = masterColours()): ColourLibrary {
  const categories: LibraryCategory[] = [];
  for (const { tone, hex } of MONK_TONES) {
    const skin = hexToOklab(hex);
    const group = skinDepthGroup(tone);
    for (const { id: undertone, label } of LIBRARY_UNDERTONES) {
      const rules = content.undertones[undertone];
      const scored = colours
        .map((colour) => {
          const u = undertoneFit(undertone, rules, colour);
          const d = depthFit(tone, skin, colour);
          return {
            colourId: colour.colourId,
            family: colour.family,
            score: Math.round(100 * (0.6 * u.score + 0.4 * d.score)),
            rank: 0,
            reasons: [u.note, ...depthReasons(tone, colour, d.contrast)],
          };
        })
        .sort((a, b) => b.score - a.score || a.colourId.localeCompare(b.colourId));
      const chosen = pick(scored, content.coloursPerCategory, content.familyCap);
      categories.push({
        categoryId: colourCategoryId(tone, undertone),
        monkTone: tone,
        undertone,
        label: `Monk ${tone} · ${label}`,
        skinHex: hex,
        rationale: `${rules.rationale} ${content.depthGroups[group]}`,
        limitations: content.limitations,
        colours: chosen.map(({ colourId, score, reasons }, i) => ({ colourId, score, rank: i + 1, reasons })),
      });
    }
  }
  return { colours, categories };
}
