import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { featureHref, findFeature } from '@/lib/features';

/**
 * Virtual Try-On for one look (#115), or for one garment of it (#124). Try-on isn't built yet (#106, #65), so
 * until `virtual-try-on` has an `href` in `features.ts` this opens its honest "Coming soon" page, never a mock
 * result. Once it does, the look is passed as `?outfitId=`, and the garment as `&slotId=`.
 */
export function TryOnButton({
  outfitId,
  lookName,
  slotId,
}: {
  outfitId: string;
  /** What is tried on, for the button's accessible name: the look's title, or an item's title. */
  lookName: string;
  slotId?: string;
}) {
  const tryOn = findFeature('virtual-try-on')!;
  const query = new URLSearchParams({ outfitId, ...(slotId ? { slotId } : {}) });
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
