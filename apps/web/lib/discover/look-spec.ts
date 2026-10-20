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

export function categoryLabel(spec: LookSpec): string {
  return label(CATEGORIES, spec.category);
}

/** Fabric, pattern and cut details that are set, e.g. ["Cotton", "Regular"]. */
export function specHints(spec: LookSpec): string[] {
  return HINTS.flatMap(([key, list]) => (spec[key] ? [label(list, spec[key])] : []));
}
