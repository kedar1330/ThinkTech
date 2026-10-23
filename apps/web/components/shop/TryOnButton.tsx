import Link from 'next/link';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { featureHref, findFeature } from '@/lib/features';

/**
 * Virtual Try-On for one look (#115). Try-on isn't built yet (#106, #65), so until `virtual-try-on` has an
 * `href` in `features.ts` this opens its honest "Coming soon" page, never a mock result. Once it does, the
 * look is passed as `?outfitId=`.
 */
export function TryOnButton({ outfitId, lookName }: { outfitId: string; lookName: string }) {
  const tryOn = findFeature('virtual-try-on')!;
  const href = tryOn.href ? `${tryOn.href}?outfitId=${outfitId}` : featureHref(tryOn);
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
