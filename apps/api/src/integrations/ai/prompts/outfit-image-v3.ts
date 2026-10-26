import { createHash } from 'node:crypto';
import { WEAR_TYPES, type LookSlot } from '@styleme/contracts';
import { joinList, occasionLabel, styleLabel } from '../../../services/engine/text';

// Outfit image prompt, version 3. Built from the look and the request around it, as Discover My Style shows
// them: each slot's generic search phrase (colour, fabric, cut, neckline, sleeve, garment), the occasion, the
// wear type and requested style, and the clothing department. Each piece's colour can be named from the
// user's My Colour Palette instead (the palette colour closest to the look's colour): colour names only.
// Version 3 adds the wear type and, for a look built around a garment the user designed in Outfit Categories
// (D-132), describes that garment with the features they chose (neckline, sleeve, length, fabric …): garment
// details only. Never the user's body type, skin tone, undertone, height, measurements or photos (AI rule 16:
// Pollinations is not an approved provider for appearance signals). Changing the wording = a new version.

export const OUTFIT_IMAGE_PROMPT_VERSION = 'outfit-image-v3';
export const OUTFIT_IMAGE_SIZE = { width: 768, height: 1024 } as const;

/** Garments only, top to bottom, so the description reads like the outfit. Shoes and accessories are left out. */
const SLOT_ORDER = ['layer', 'one_piece', 'top', 'bottom'];

/** Design feature categories left out of the picture: the occasion is said once already, stretch can't be seen. */
const UNSEEN_FEATURES = new Set(['occasion', 'stretch']);

/** The word that makes a bare feature name read as part of a garment ("Curved" → "curved hemline"). */
const FEATURE_NOUN: Record<string, string> = {
  neckline: 'neckline',
  sleeve: 'sleeves',
  silhouette: 'silhouette',
  hemline: 'hemline',
  fabric: 'fabric',
  closure: 'closure',
  layering: 'style layering',
  waistline: 'waistline',
  waistband: 'waistband',
  leg_shape: 'leg shape',
  pleats: 'pleats',
  bottom_hem: 'hem',
  draping: 'drape',
  pattern: 'pattern',
  fit: 'fit',
  length: 'length',
};

export interface OutfitImageDesign {
  /** The look category of the designed garment (`kurta` …); the slot showing it is described by the design. */
  category: string;
  /** The garment's name, e.g. "Kurta". */
  garmentName: string;
  /** The garment type ID, e.g. "top", "saree_blouse", "anarkali". */
  garmentType?: string;
  /** The garment kind: 'top' | 'bottom' | 'one_piece' | 'layer' | 'drape'. */
  garmentKind?: string;
  /** The chosen features, by design feature category, e.g. `{ category: 'neckline', name: 'Round neck' }`. */
  features: readonly { category: string; name: string }[];
}

export interface OutfitImagePromptInput {
  slots: readonly LookSlot[];
  occasion: string;
  style?: string | null;
  /** The wear type (`indian`, `fusion` or `western`) from Outfit Categories, when the request has one. */
  wearType?: string | null;
  /** The look's clothing department (`women`, `men` or `any`), never anything about the user's body. */
  department?: string | null;
  /** Slot ID → the palette colour name to show that piece in, replacing the look's colour word. */
  colours?: ReadonlyMap<string, string>;
  /** The garment the user designed in Outfit Categories, when the look was built around it. */
  design?: OutfitImageDesign | null;
}

/** The slot's phrase with its leading colour word replaced by `colour`, when the phrase starts with it. */
function inColour(slot: LookSlot, colour: string | undefined): string {
  if (!colour) return slot.searchPhrase;
  const current = slot.swatches[0]?.name.toLowerCase();
  if (current && slot.searchPhrase.toLowerCase().startsWith(current)) {
    return `${colour.toLowerCase()}${slot.searchPhrase.slice(current.length)}`;
  }
  const firstSpace = slot.searchPhrase.indexOf(' ');
  if (firstSpace > 0) {
    return `${colour.toLowerCase()} ${slot.searchPhrase.slice(firstSpace + 1).trim()}`;
  }
  return `${colour.toLowerCase()} ${slot.searchPhrase}`;
}

function featurePhrase({ category, name }: { category: string; name: string }): string {
  const phrase = name.toLowerCase().trim();
  if (category === 'pockets' && (phrase.includes('no') || phrase.includes('none'))) {
    return '';
  }
  const noun = FEATURE_NOUN[category];
  if (!noun) return phrase;
  if (phrase.includes(noun)) return phrase;
  if (category === 'neckline' && phrase.includes('neck')) return phrase;
  if (category === 'sleeve' && phrase.includes('sleeve')) return phrase;
  return `${phrase} ${noun}`;
}

/** The designed garment in the slot's colour, with the features the user chose. */
function designed(slot: LookSlot, colour: string | undefined, design: OutfitImageDesign): string {
  const shade = (colour ?? slot.swatches[0]?.name ?? '').toLowerCase();
  const isSareeBlouse = design.garmentName.toLowerCase().includes('saree blouse');
  const features = design.features
    .filter((f) => !UNSEEN_FEATURES.has(f.category))
    .map(featurePhrase)
    .filter(Boolean);
  if (isSareeBlouse) {
    const blouse = [shade, 'saree blouse'].filter(Boolean).join(' ');
    const blouseWithFeatures = features.length > 0 ? `${blouse} with ${joinList(features)}` : blouse;
    return `traditional elegant draped saree paired with matching ${blouseWithFeatures}`;
  }
  const garment = [shade, design.garmentName.toLowerCase()].filter(Boolean).join(' ');
  return features.length > 0 ? `${garment} with ${joinList(features)}` : garment;
}

const TOP_GARMENT_TYPES = new Set([
  'top',
  'blouse',
  'shirt',
  't_shirt',
  'tunic',
  'kurti',
  'kurta',
  'polo',
  'short_kurta',
]);
const BOTTOM_GARMENT_TYPES = new Set(['trousers', 'jeans', 'palazzo', 'skirt', 'dhoti_pants', 'churidar', 'shorts']);
const ONE_PIECE_GARMENT_TYPES = new Set([
  'dress',
  'lehenga',
  'anarkali',
  'jumpsuit',
  'indo_western_gown',
  'saree',
  'saree_blouse',
]);
const LAYER_GARMENT_TYPES = new Set(['jacket', 'cape_jacket', 'sherwani', 'nehru_jacket', 'bandhgala']);

function isDesignSlot(slot: LookSlot, design: OutfitImageDesign): boolean {
  if (slot.lookSpec?.category === design.category) return true;
  if (design.category === 'saree' && (slot.slot === 'one_piece' || slot.lookSpec?.category === 'saree')) return true;

  if (design.garmentKind === 'top' && slot.slot === 'top') return true;
  if (design.garmentKind === 'bottom' && slot.slot === 'bottom') return true;
  if ((design.garmentKind === 'one_piece' || design.garmentKind === 'drape') && slot.slot === 'one_piece') return true;
  if (design.garmentKind === 'layer' && slot.slot === 'layer') return true;

  const type = design.garmentType ?? design.category;
  if (TOP_GARMENT_TYPES.has(type) && slot.slot === 'top') return true;
  if (BOTTOM_GARMENT_TYPES.has(type) && slot.slot === 'bottom') return true;
  if (ONE_PIECE_GARMENT_TYPES.has(type) && slot.slot === 'one_piece') return true;
  if (LAYER_GARMENT_TYPES.has(type) && slot.slot === 'layer') return true;

  return false;
}

function enhanceColourForAi(phrase: string): string {
  return phrase
    .replace(/\brama green\b/gi, 'rama green (rich vibrant teal sea green)')
    .replace(/\bsea\b(?!\s*green)/gi, 'sea green')
    .replace(/\bmehendi green\b/gi, 'mehendi green (warm olive green)')
    .replace(/\brani pink\b/gi, 'rani pink (vibrant hot magenta pink)')
    .replace(/\bhaldi yellow\b/gi, 'haldi yellow (warm golden turmeric yellow)')
    .replace(/\bpista green\b/gi, 'pista green (light pistachio pastel green)')
    .replace(/\bpeacock blue\b/gi, 'peacock blue (rich royal teal blue)');
}

export function buildOutfitImagePrompt({
  slots,
  occasion,
  style,
  wearType,
  department,
  colours,
  design,
}: OutfitImagePromptInput): string {
  const figure = department === 'women' ? 'a woman' : department === 'men' ? 'a man' : 'a fashion model';
  let pieces = slots
    .filter((s) => SLOT_ORDER.includes(s.slot))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
    .map((s) => {
      const colour = colours?.get(s.slotId);
      return design && isDesignSlot(s, design) ? designed(s, colour, design) : inColour(s, colour);
    });

  const isAnarkali =
    design?.garmentName?.toLowerCase().includes('anarkali') ||
    slots.some((s) => s.searchPhrase.toLowerCase().includes('anarkali'));

  if (isAnarkali) {
    pieces = pieces.map((p) => {
      if (/\b(kurti|kurta|anarkali)\b/i.test(p)) {
        return p.replace(/\b(kurti|kurta|anarkali)\b/gi, 'flared anarkali suit with voluminous kalidar umbrella flare');
      }
      return p;
    });
    if (!pieces.some((p) => p.toLowerCase().includes('anarkali'))) {
      pieces.unshift('flared kalidar anarkali suit');
    }
  }

  const isSaree =
    design?.garmentName?.toLowerCase().includes('saree') ||
    slots.some((s) => s.searchPhrase.toLowerCase().includes('saree'));

  if (isSaree) {
    pieces = pieces.map((p) => {
      if (/\b(kurti|kurta)\b/i.test(p)) {
        return p.replace(/\b(kurti|kurta)\b/gi, 'traditional elegant draped saree with tailored saree blouse');
      }
      return p;
    });
    if (!pieces.some((p) => p.toLowerCase().includes('saree'))) {
      pieces.unshift('traditional elegant draped saree with tailored saree blouse');
    }
  }

  pieces = pieces.map(enhanceColourForAi);

  const wear = WEAR_TYPES.find((w) => w.id === wearType)?.label;
  const kind = [occasionLabel(occasion), wear, style ? styleLabel(style) : null]
    .filter(Boolean)
    .map((part) => part!.toLowerCase())
    .join(' ');
  return [
    `Full-length fashion lookbook photograph of ${figure} wearing ${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind} outfit: ${joinList(pieces)}.`,
    'Standing upright facing the camera, whole body visible from head to shoes, natural relaxed pose.',
    'Plain light grey studio background, soft even lighting, realistic fabric texture and true colours.',
    'One person only. No text, no logos, no watermark, no brand names.',
  ].join(' ');
}

/** A stable seed per prompt, so the same look always asks for the same picture. */
export function seedFor(prompt: string): number {
  return createHash('sha256').update(prompt).digest().readUInt32BE(0) & 0x7fffffff;
}
