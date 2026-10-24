import Link from 'next/link';
import { Camera, ShoppingBag } from 'lucide-react';
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
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
        <Link
          href={`/shop?outfitId=${look.id}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-plum/10 px-3 py-1 text-xs font-semibold text-plum hover:bg-plum/20 transition-colors"
        >
          <ShoppingBag className="size-3.5" />
          Shop
        </Link>
        <Link
          href={`/try-on?outfitId=${look.id}`}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-plum/30 bg-surface px-3 py-1 text-xs font-semibold text-plum hover:bg-plum/10 transition-colors"
        >
          <Camera className="size-3.5" />
          Try-On
        </Link>
        <RemoveLookButton outfitId={look.id} lookName={title} from="list" />
      </div>
    </Card>
  );
}
