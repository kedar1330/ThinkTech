import {
  CATEGORIES,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  NECKLINES,
  PATTERNS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  type LookSpec,
} from '@styleme/contracts';

// Labels for what a look slot (or one of its alternatives) describes, from the shared vocabulary.

type Vocabulary = readonly { id: string; label: string }[];

const HINTS: [keyof LookSpec, Vocabulary][] = [
  ['fabric', FABRICS],
  ['pattern', PATTERNS],
  ['fit', FITS],
  ['silhouette', SILHOUETTES],
  ['neckline', NECKLINES],
  ['sleeve', SLEEVE_LENGTHS],
  ['length', GARMENT_LENGTHS],
];

const label = (list: Vocabulary, id: string) => list.find((o) => o.id === id)?.label ?? id;

export function categoryLabel(spec: LookSpec, searchPhrase?: string): string {
  if (searchPhrase) {
    const p = searchPhrase.toLowerCase();
    if (p.includes('anarkali')) return 'Anarkali';
    if (p.includes('saree blouse')) return 'Saree Blouse';
    if (p.includes('dhoti')) return 'Dhoti Pants';
    if (p.includes('palazzo')) return 'Palazzo';
    if (p.includes('indo-western gown') || p.includes('gown')) return 'Gown';
    if (p.includes('jumpsuit')) return 'Jumpsuit';
    if (p.includes('tunic')) return 'Tunic';
    if (p.includes('cape')) return 'Cape Set';
  }
  return label(CATEGORIES, spec.category);
}

/** Fabric, pattern and cut details that are set, e.g. ["Cotton", "Regular"]. */
export function specHints(spec: LookSpec): string[] {
  return HINTS.flatMap(([key, list]) => (spec[key] ? [label(list, spec[key])] : []));
}
