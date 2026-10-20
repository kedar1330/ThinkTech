import type { LookSlot, ProfileSizes } from '@styleme/contracts';
import { categoryLabel, specHints } from '@/lib/discover/look-spec';
import { SearchPhrase } from './SearchPhrase';
import { SizeNote } from './SizeNote';
import { SlotAlternatives } from './SlotAlternatives';
import { Swatch } from './Swatch';

// One garment in a look: what it is, its colours, fabric and cut hints, a copyable search phrase, the size
// note and its alternatives.

export function SlotRow({ slot, sizes }: { slot: LookSlot; sizes: ProfileSizes }) {
  const spec = slot.lookSpec;
  const hints = specHints(spec);
  return (
    <li className="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{categoryLabel(spec)}</p>
      <ul aria-label="Colours" className="flex flex-wrap gap-x-3 gap-y-1">
        {slot.swatches.map((swatch) => (
          <li key={swatch.colorId}>
            <Swatch swatch={swatch} />
          </li>
        ))}
      </ul>
      {hints.length > 0 && <p className="text-xs text-muted-foreground">{hints.join(' · ')}</p>}
      <SearchPhrase phrase={slot.searchPhrase} />
      <SizeNote category={spec.category} sizes={sizes} />
      <SlotAlternatives alternatives={slot.alternatives} />
    </li>
  );
}
