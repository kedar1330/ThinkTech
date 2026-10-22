import Link from 'next/link';
import type { Look } from '@styleme/contracts';
import { Card } from '@/components/ui/card';
import { garmentSlots, lookTitle, slotLabel } from '@/lib/outfits/look-text';
import { OutfitImage } from './OutfitImage';
import { RemoveLookButton } from './RemoveLookButton';
import { SwatchList } from './SwatchList';

/**
 * One saved look in the Saved Outfits list: its pieces and colours (named), the reason, and remove. The
 * discovery results page uses the fuller `LookCard`.
 */
export function SavedLookCard({ look }: { look: Look }) {
  const title = lookTitle(look);
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <h2 className="font-medium leading-snug">
        <Link href={`/saved/${look.id}`} className="text-primary underline-offset-4 hover:underline">
          {title}
        </Link>
      </h2>
      {/* Only a stored image here: opening the look creates one, so the list never starts many at once. */}
      {look.image === 'ready' && <OutfitImage outfitId={look.id} ready />}
      <ul className="space-y-2">
        {garmentSlots(look).map((slot) => (
          <li key={slot.slotId} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{slotLabel(slot.slot)}</p>
            <SwatchList swatches={slot.swatches} />
          </li>
        ))}
      </ul>
      <p className="line-clamp-3 text-sm text-muted-foreground">{look.explanation}</p>
      <div className="mt-auto">
        <RemoveLookButton outfitId={look.id} lookName={title} from="list" />
      </div>
    </Card>
  );
}
