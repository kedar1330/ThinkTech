import {
  CATEGORIES,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  NECKLINES,
  PATTERNS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  type LookSlot,
  type LookSpec,
  type ProfileSizes,
} from '@styleme/contracts';
import { SizeNote } from './SizeNote';
import { Swatch } from './Swatch';

// One garment in a look: what it is, its colours, fabric and cut hints, a search phrase and the size note.

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

export function SlotRow({ slot, sizes }: { slot: LookSlot; sizes: ProfileSizes }) {
  const spec = slot.lookSpec;
  const hints = HINTS.flatMap(([key, list]) => (spec[key] ? [label(list, spec[key])] : []));
  return (
    <li className="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{label(CATEGORIES, spec.category)}</p>
      <ul aria-label="Colours" className="flex flex-wrap gap-x-3 gap-y-1">
        {slot.swatches.map((swatch) => (
          <li key={swatch.colorId}>
            <Swatch swatch={swatch} />
          </li>
        ))}
      </ul>
      {hints.length > 0 && <p className="text-xs text-muted-foreground">{hints.join(' · ')}</p>}
      <p className="break-words text-xs text-muted-foreground">
        Search for: <span className="text-foreground">{slot.searchPhrase}</span>
      </p>
      <SizeNote category={spec.category} sizes={sizes} />
    </li>
  );
}
