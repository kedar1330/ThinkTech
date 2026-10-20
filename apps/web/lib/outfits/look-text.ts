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

/** E.g. "Navy kurta · Ivory trousers": names every piece with its colour in words. */
export function lookTitle(look: Pick<Look, 'slots'>): string {
  return look.slots
    .map(
      (s) => `${vocabLabel(COLORS, s.lookSpec.colorId)} ${vocabLabel(CATEGORIES, s.lookSpec.category).toLowerCase()}`,
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
export function specAttributes(spec: LookSpec): { term: string; value: string }[] {
  return SPEC_TERMS.flatMap(({ key, term, list }) => {
    const id = spec[key];
    return id ? [{ term, value: vocabLabel(list, id) }] : [];
  });
}
