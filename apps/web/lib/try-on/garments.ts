import type { BodyType, LookSlot, ProductListing } from '@styleme/contracts';

// The 3D mannequin's outfit (D-137): which items from Shop My Look are worn, and the 3D garment each becomes.
// A garment is drawn from its category and the look's cut (sleeve, length, silhouette) in the item's colour;
// it is a preview of type and colour, never the item's exact print, fit or drape. Pure functions only, so the
// rules can be tested without WebGL.

export type SleeveLength = 'none' | 'cap' | 'short' | 'elbow' | 'three_quarter' | 'full';
/** Where a garment ends, from the waist down. */
export type HemLength = 'cropped' | 'waist' | 'hip' | 'thigh' | 'knee' | 'midi' | 'ankle' | 'floor';

/** A front detail that tells similar tops apart: a kurta's button placket, a shirt's collar and buttons. */
export type FrontDetail = 'placket' | 'collar';

export type GarmentShape =
  | { kind: 'top'; hem: HemLength; sleeve: SleeveLength; flare: number; detail?: FrontDetail }
  | { kind: 'trousers'; hem: HemLength; width: number }
  | { kind: 'dress'; hem: HemLength; sleeve: SleeveLength; flare: number }
  | { kind: 'saree'; sleeve: SleeveLength }
  | { kind: 'lehenga'; sleeve: SleeveLength };

/** A worn item: the listing from Shop My Look, the part of the look it is for, its 3D shape and colour. */
export interface WornItem {
  slotId: string;
  slot: LookSlot['slot'];
  listing: ProductListing;
  shape: GarmentShape;
  /** `#rrggbb`: read from the item's picture, else the look's colour for that part. */
  colour: string;
}

/** The parts of a look that can be worn by the mannequin (footwear and accessories are not shown, #111). */
export const WEARABLE_SLOTS = ['one_piece', 'bottom', 'top', 'layer'] as const;
export const isWearable = (slot: LookSlot['slot']) => (WEARABLE_SLOTS as readonly string[]).includes(slot);

const SLEEVES: Record<string, SleeveLength> = {
  sleeveless: 'none',
  cap: 'cap',
  short: 'short',
  elbow: 'elbow',
  three_quarter: 'three_quarter',
  full: 'full',
};
const HEMS = new Set<HemLength>(['cropped', 'waist', 'hip', 'thigh', 'knee', 'midi', 'ankle', 'floor']);

/** How much a silhouette flares out from the body: 0 is close-fitting, 1 is very full. */
function flareOf(silhouette: string | undefined, fallback: number): number {
  switch (silhouette) {
    case 'fitted':
    case 'tapered':
      return 0.05;
    case 'straight':
      return 0.15;
    case 'relaxed':
    case 'wrap':
      return 0.3;
    case 'a_line':
      return 0.5;
    case 'flared':
    case 'wide_leg':
    case 'oversized':
      return 0.8;
    default:
      return fallback;
  }
}

/** The 3D garment for one part of a look, from its category and cut. */
export function shapeFor(slot: Pick<LookSlot, 'slot' | 'lookSpec'>): GarmentShape {
  const { category, sleeve, length, silhouette } = slot.lookSpec;
  const sleeveOf = (fallback: SleeveLength) => (sleeve && SLEEVES[sleeve]) || fallback;
  const hemOf = (fallback: HemLength) => (length && HEMS.has(length as HemLength) ? (length as HemLength) : fallback);
  switch (category) {
    case 't_shirt':
      return { kind: 'top', hem: hemOf('hip'), sleeve: sleeveOf('short'), flare: flareOf(silhouette, 0.15) };
    case 'shirt':
      return {
        kind: 'top',
        hem: hemOf('hip'),
        sleeve: sleeveOf('full'),
        flare: flareOf(silhouette, 0.15),
        detail: 'collar',
      };
    case 'kurta':
      return {
        kind: 'top',
        hem: hemOf('knee'),
        sleeve: sleeveOf('full'),
        flare: flareOf(silhouette, 0.3),
        detail: 'placket',
      };
    case 'kurti':
      return {
        kind: 'top',
        hem: hemOf('thigh'),
        sleeve: sleeveOf('three_quarter'),
        flare: flareOf(silhouette, 0.3),
        detail: 'placket',
      };
    case 'jeans':
      return { kind: 'trousers', hem: hemOf('ankle'), width: flareOf(silhouette, 0.1) };
    case 'trousers':
      return { kind: 'trousers', hem: hemOf('ankle'), width: flareOf(silhouette, 0.25) };
    case 'dress':
      return { kind: 'dress', hem: hemOf('knee'), sleeve: sleeveOf('short'), flare: flareOf(silhouette, 0.5) };
    case 'saree':
      return { kind: 'saree', sleeve: sleeveOf('short') };
    case 'lehenga':
      return { kind: 'lehenga', sleeve: sleeveOf('short') };
    default:
      // Anything else worn on the body: a top or layer, a bottom, or a dress by the part of the look.
      if (slot.slot === 'bottom') return { kind: 'trousers', hem: hemOf('ankle'), width: 0.2 };
      if (slot.slot === 'one_piece')
        return { kind: 'dress', hem: hemOf('knee'), sleeve: sleeveOf('short'), flare: 0.5 };
      return { kind: 'top', hem: hemOf('hip'), sleeve: sleeveOf('full'), flare: 0.2 };
  }
}

/**
 * Puts an item on: it replaces the item worn for the same part of the look; a one-piece also takes off the top
 * and bottom, and a top or bottom takes off a one-piece. Returns a new outfit.
 */
export function wear(outfit: readonly WornItem[], item: WornItem): WornItem[] {
  const clashes = (worn: WornItem) =>
    worn.slotId === item.slotId ||
    (item.slot === 'one_piece' && (worn.slot === 'top' || worn.slot === 'bottom')) ||
    ((item.slot === 'top' || item.slot === 'bottom') && worn.slot === 'one_piece');
  return [...outfit.filter((w) => !clashes(w)), item];
}

export const takeOff = (outfit: readonly WornItem[], slotId: string): WornItem[] =>
  outfit.filter((w) => w.slotId !== slotId);

/** Drawing order, from the body out: one-piece and bottom, then the top, then a layer over it. */
export function layered(outfit: readonly WornItem[]): WornItem[] {
  const order = (w: WornItem) => WEARABLE_SLOTS.indexOf(w.slot as (typeof WEARABLE_SLOTS)[number]);
  return [...outfit].sort((a, b) => order(a) - order(b));
}

export const sameListing = (a: Pick<ProductListing, 'store' | 'title' | 'price'>, b: typeof a) =>
  a.store === b.store && a.title === b.title && a.price === b.price;

/** Body proportions of the mannequin, relative to a straight figure, by body type. */
export interface Proportions {
  shoulders: number;
  bust: number;
  waist: number;
  hips: number;
}

const BODY: Partial<Record<BodyType, Proportions>> = {
  hourglass: { shoulders: 1, bust: 1.06, waist: 0.86, hips: 1.06 },
  top_hourglass: { shoulders: 1.02, bust: 1.08, waist: 0.88, hips: 1.02 },
  bottom_hourglass: { shoulders: 0.98, bust: 1.02, waist: 0.88, hips: 1.08 },
  pear: { shoulders: 0.94, bust: 0.96, waist: 0.94, hips: 1.12 },
  spoon: { shoulders: 0.94, bust: 0.98, waist: 0.92, hips: 1.12 },
  triangle: { shoulders: 0.94, bust: 0.98, waist: 1, hips: 1.08 },
  rectangle: { shoulders: 1, bust: 1, waist: 1, hips: 1 },
  inverted_triangle: { shoulders: 1.12, bust: 1.06, waist: 0.98, hips: 0.94 },
  trapezoid: { shoulders: 1.1, bust: 1.06, waist: 0.96, hips: 0.98 },
  oval: { shoulders: 1, bust: 1.06, waist: 1.14, hips: 1.04 },
  diamond: { shoulders: 0.96, bust: 1, waist: 1.1, hips: 1.02 },
};

export const proportionsFor = (bodyType: BodyType | null | undefined): Proportions =>
  (bodyType && BODY[bodyType]) || { shoulders: 1, bust: 1, waist: 1, hips: 1 };

/** `#rrggbb` for a colour, or null when it isn't one. */
export function hexOrNull(value: string | null | undefined): string | null {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

/**
 * The main colour of a product picture, from its RGBA pixels: the busiest of 4096 colour buckets, ignoring
 * transparent pixels and the near-white or near-grey backdrop that store photos use. Null when nothing is left.
 */
export function dominantColour(rgba: Uint8ClampedArray, width: number, height: number): string | null {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  // The middle of the picture, where the garment usually is; the edges are mostly background.
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.ceil(width * 0.8);
  const y0 = Math.floor(height * 0.15);
  const y1 = Math.ceil(height * 0.85);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = [rgba[i]!, rgba[i + 1]!, rgba[i + 2]!, rgba[i + 3]!];
      if (a < 128) continue;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Backdrop: very light and nearly colourless.
      if (min > 225 && max - min < 18) continue;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
  if (!best) return null;
  const hex = (v: number) =>
    Math.round(v / best!.n)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`;
}
