import { COLORS, type ColorId } from '@styleme/contracts';

// Colours chosen in My Colour Palette (the colour library, D-133) are named library colours with a hex value;
// looks are built from the style vocabulary's colours. Each library colour is matched to the nearest vocabulary
// colour by distance in OKLab, a space where equal distances look equally different. Pure.

/** A liked colour counts for its nearest vocabulary colour, however far: liking only ever ranks looks. */
export const LIKED_MAX_DISTANCE = Number.POSITIVE_INFINITY;
/**
 * An avoided colour removes a vocabulary colour only when the two look almost the same, so avoiding one shade
 * never takes away a whole colour family (avoided colours are a hard filter, FR-LOOK-06).
 */
export const AVOIDED_MAX_DISTANCE = 0.06;

type Lab = [number, number, number];

function toLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex (`#RRGGBB`) → OKLab. */
export function hexToOklab(hex: string): Lab {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [toLinear((n >> 16) & 255), toLinear((n >> 8) & 255), toLinear(n & 255)];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const VOCABULARY = COLORS.map((c) => ({ id: c.id as ColorId, lab: hexToOklab(c.hex) }));

/** The vocabulary colour that looks closest to `hex`, and how far it is. Ties break on vocabulary order. */
export function nearestColour(hex: string): { colorId: ColorId; distance: number } {
  const lab = hexToOklab(hex);
  let best = { colorId: VOCABULARY[0]!.id, distance: distance(lab, VOCABULARY[0]!.lab) };
  for (const c of VOCABULARY.slice(1)) {
    const d = distance(lab, c.lab);
    if (d < best.distance) best = { colorId: c.id, distance: d };
  }
  return best;
}

/** The candidate that looks closest to `hex` (ties go to the earlier candidate), or null when there are none. */
export function closestOf<T extends { hex: string }>(hex: string, candidates: readonly T[]): T | null {
  const lab = hexToOklab(hex);
  let best: { item: T; d: number } | null = null;
  for (const item of candidates) {
    const d = distance(lab, hexToOklab(item.hex));
    if (!best || d < best.d) best = { item, d };
  }
  return best?.item ?? null;
}

/** Library colours (hex) → vocabulary colour IDs within `maxDistance`, deduplicated, in the order given. */
export function vocabularyColours(hexes: readonly string[], maxDistance: number): ColorId[] {
  const ids = hexes
    .map(nearestColour)
    .filter((m) => m.distance <= maxDistance)
    .map((m) => m.colorId);
  return [...new Set(ids)];
}
