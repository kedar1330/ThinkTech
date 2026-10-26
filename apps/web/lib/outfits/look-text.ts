import {
  CATEGORIES,
  COLOR_FAMILIES,
  COLORS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  NECKLINES,
  PATTERNS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  SLOT_TYPES,
  type Look,
  type LookSpec,
} from '@styleme/contracts';

// Text for a look, from the shared vocabulary labels (never the raw IDs where a label exists).

type Vocabulary = readonly { id: string; label: string }[];

export const vocabLabel = (list: Vocabulary, id: string) => list.find((o) => o.id === id)?.label ?? id;

export const slotLabel = (slot: string) => vocabLabel(SLOT_TYPES, slot);

const GARMENT_SLOTS = new Set(['layer', 'one_piece', 'top', 'bottom']);

/** Returns the display name for a garment slot, respecting custom designs like Anarkali, Palazzo, etc. */
export function slotGarmentName(slot: { searchPhrase?: string; lookSpec: LookSpec }): string {
  const phrase = slot.searchPhrase?.toLowerCase() ?? '';
  if (phrase.includes('anarkali')) return 'Anarkali';
  if (phrase.includes('saree blouse')) return 'Saree Blouse';
  if (phrase.includes('dhoti')) return 'Dhoti Pants';
  if (phrase.includes('palazzo')) return 'Palazzo';
  if (phrase.includes('indo-western gown') || phrase.includes('gown')) return 'Gown';
  if (phrase.includes('jumpsuit')) return 'Jumpsuit';
  if (phrase.includes('tunic')) return 'Tunic';
  if (phrase.includes('cape')) return 'Cape Set';
  if (phrase.includes('skirt')) return 'Skirt';
  if (/\bblouse\b/i.test(phrase)) return 'Blouse';
  if (/\btop\b/i.test(phrase)) return 'Top';
  return vocabLabel(CATEGORIES, slot.lookSpec.category);
}

/** The pieces shown for a look: its garments only, without footwear or accessories. */
export function garmentSlots(look: Pick<Look, 'slots'>): Look['slots'] {
  return look.slots.filter((s) => GARMENT_SLOTS.has(s.slot));
}

/** E.g. "Navy kurta · Ivory trousers": names every garment with its colour in words. */
export function lookTitle(look: Pick<Look, 'slots'>): string {
  return garmentSlots(look)
    .map(
      (s) => `${vocabLabel(COLORS, s.lookSpec.colorId)} ${slotGarmentName(s).toLowerCase()}`,
    )
    .join(' · ');
}

const SPEC_TERMS: { key: keyof LookSpec; term: string; list: Vocabulary }[] = [
  { key: 'category', term: 'Piece', list: CATEGORIES },
  { key: 'colorId', term: 'Colour', list: COLORS },
  { key: 'colorFamily', term: 'Colour family', list: COLOR_FAMILIES },
  { key: 'fabric', term: 'Fabric', list: FABRICS },
  { key: 'fit', term: 'Fit', list: FITS },
  { key: 'silhouette', term: 'Silhouette', list: SILHOUETTES },
  { key: 'neckline', term: 'Neckline', list: NECKLINES },
  { key: 'sleeve', term: 'Sleeves', list: SLEEVE_LENGTHS },
  { key: 'length', term: 'Length', list: GARMENT_LENGTHS },
  { key: 'pattern', term: 'Pattern', list: PATTERNS },
];

/** The attributes a slot's specification states, labelled, in a fixed order. */
export function specAttributes(spec: LookSpec, slot?: { searchPhrase?: string }): { term: string; value: string }[] {
  return SPEC_TERMS.flatMap(({ key, term, list }) => {
    if (key === 'category' && slot) {
      return [{ term, value: slotGarmentName({ searchPhrase: slot.searchPhrase, lookSpec: spec }) }];
    }
    const id = spec[key];
    return id ? [{ term, value: vocabLabel(list, id) }] : [];
  });
}
