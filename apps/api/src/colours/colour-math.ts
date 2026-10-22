// sRGB → OKLab / OKLCH (Björn Ottosson, 2020). OKLab is perceptually even, so lightness, chroma, hue and
// distances between colours mean roughly the same thing everywhere in the colour space.

export interface Oklab {
  l: number;
  a: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  /** Degrees, 0 – 360; 0 for colours without chroma. */
  h: number;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a hex colour: ${hex}`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function hexToOklab(hex: string): Oklab {
  const [r, g, b] = hexToRgb(hex).map(linear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToOklch({ l, a, b }: Oklab): Oklch {
  const c = Math.hypot(a, b);
  const h = c < 1e-4 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;
  return { l, c, h: (h + 360) % 360 };
}

export function hexToOklch(hex: string): Oklch {
  return oklabToOklch(hexToOklab(hex));
}

/** Euclidean distance in OKLab: about 0.02 is a just-noticeable difference. */
export function deltaE(x: Oklab, y: Oklab): number {
  return Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);
}

/** Shortest distance between two hues, 0 – 180 degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** 1 at `centre`, falling off as a Gaussian with spread `sigma`. */
export function bell(x: number, centre: number, sigma: number): number {
  return Math.exp(-((x - centre) ** 2) / (2 * sigma ** 2));
}
