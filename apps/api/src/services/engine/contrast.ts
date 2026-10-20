import { COLORS, type ColorId } from '@styleme/contracts';

// Whether a look actually has the contrast of the palette combination it is built on, so the engine
// never claims a contrast the worn colours don't have (T-21). Uses the WCAG 2 contrast ratio of the
// vocabulary hex values; no thresholds: the combination's approved contrast level stands for its
// strongest colour pair.

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

const LUMINANCE = new Map<string, number>(COLORS.map((c) => [c.id, luminance(c.hex)]));

/** The strongest WCAG contrast ratio between any two of the colours (1 for fewer than two). */
export function strongestContrast(colors: Iterable<ColorId>): number {
  const values = [...new Set(colors)].map((c) => LUMINANCE.get(c)!);
  let strongest = 1;
  for (const a of values) for (const b of values) strongest = Math.max(strongest, (a + 0.05) / (b + 0.05));
  return strongest;
}

/**
 * True when the look's colours have the combination's contrast: the look's strongest pair is as strong
 * as the combination's strongest pair (or stronger, for a high-contrast combination), never weaker.
 */
export function wearsContrast(
  combination: { colors: readonly ColorId[]; contrastLevel: string },
  lookColors: Iterable<ColorId>,
): boolean {
  const target = strongestContrast(combination.colors);
  const worn = strongestContrast(lookColors);
  const same = Math.abs(worn - target) < 1e-9;
  return same || (combination.contrastLevel === 'high' && worn > target);
}
