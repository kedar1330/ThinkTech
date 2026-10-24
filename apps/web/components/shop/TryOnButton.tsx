import Link from 'next/link';
import { Camera } from 'lucide-react';
import type { TryOnItem } from '@styleme/contracts';
import { Button } from '@/components/ui/button';
import { featureHref, findFeature } from '@/lib/features';

/**
 * Virtual Try-On for one look (#115), for one garment of it (#124), or for one similar item (D-137). It opens
 * `/try-on` with the look as `?outfitId=`, the garment as `&slotId=` and the item as `&store=&title=&price=`.
 * While `virtual-try-on` has no `href` in `features.ts` it opens the honest "Coming soon" page instead.
 */
export function TryOnButton({
  outfitId,
  lookName,
  slotId,
  item,
}: {
  outfitId: string;
  /** What is tried on, for the button's accessible name: the look's title, or an item's title. */
  lookName: string;
  slotId?: string;
  /** The similar item to try on (with `slotId`). */
  item?: TryOnItem;
}) {
  const tryOn = findFeature('virtual-try-on')!;
  const query = new URLSearchParams({
    outfitId,
    ...(slotId ? { slotId } : {}),
    ...(slotId && item ? { store: item.store, title: item.title, price: String(item.price) } : {}),
  });
  const href = tryOn.href ? `${tryOn.href}?${query.toString()}` : featureHref(tryOn);
  return (
    <Button asChild variant="outline" size="sm" className="h-8 w-full px-3 text-xs">
      <Link href={href} aria-label={`${tryOn.label}: ${lookName}${tryOn.href ? '' : ' (coming soon)'}`}>
        <Camera aria-hidden />
        {tryOn.label}
        {!tryOn.href && <span className="font-normal text-muted-foreground">· Soon</span>}
      </Link>
    </Button>
  );
}
