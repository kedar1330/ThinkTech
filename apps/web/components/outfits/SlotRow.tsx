import type { LookSlot, ProfileSizes } from '@styleme/contracts';
import { categoryLabel, specHints } from '@/lib/discover/look-spec';
import { SearchPhrase } from './SearchPhrase';
import { SizeNote } from './SizeNote';
import { SlotVisual } from './SlotVisual';

// One garment in a look: what it is, its colours, fabric and cut hints, a copyable search phrase, the size
// note and its slot visual (#50).

export function SlotRow({ slot, sizes }: { slot: LookSlot; sizes: ProfileSizes }) {
  const spec = slot.lookSpec;
  const hints = specHints(spec);
  return (
    <li className="space-y-1.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{categoryLabel(spec)}</p>
      <SlotVisual swatches={slot.swatches} illustration={slot.illustration} />
      {hints.length > 0 && <p className="text-xs text-muted-foreground">{hints.join(' · ')}</p>}
      <SearchPhrase phrase={slot.searchPhrase} />
      <SizeNote category={spec.category} sizes={sizes} />
    </li>
  );
}
