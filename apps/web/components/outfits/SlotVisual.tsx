import Image from 'next/image';
import type { Swatch as SwatchData } from '@styleme/contracts';
import { cn } from '@/lib/utils';

// Shared visual for a look slot (FR-DATA-06, D-65, issue #50).
// Shows a labelled style illustration when a cleared asset exists, and labelled colour swatches
// otherwise. Swatches are the default everywhere until assets are cleared.

/** The illustration record attached to a slot (illustrationSchema in outfit.ts). */
interface Illustration {
  url: string;
  licenceLabel: string;
}

interface SlotVisualProps {
  swatches: readonly SwatchData[];
  illustration?: Illustration | null;
  /** Optional extra class names on the root. */
  className?: string;
}

const ILLUSTRATION_LABEL = 'Style illustration — not a product';

/**
 * A shared visual for one look slot. When a cleared illustration exists it is shown with the
 * mandatory label "Style illustration — not a product" and a licence tooltip. When no illustration
 * is available (or it has no licence) it falls back to labelled colour swatches where the name
 * carries the meaning and the chip is decorative.
 */
export function SlotVisual({ swatches, illustration, className }: SlotVisualProps) {
  const hasIllustration = illustration?.url && illustration?.licenceLabel;

  if (hasIllustration) {
    return (
      <figure className={cn('space-y-1.5', className)} data-testid="slot-visual-illustration">
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-border bg-surface-muted">
          <Image
            src={illustration.url}
            alt={ILLUSTRATION_LABEL}
            fill
            sizes="(max-width: 640px) 100vw, 50vw"
            className="object-contain"
          />
        </div>
        <figcaption className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">{ILLUSTRATION_LABEL}</p>
          <p className="text-[10px] text-muted-foreground/70" title={illustration.licenceLabel}>
            Licence: {illustration.licenceLabel}
          </p>
        </figcaption>
      </figure>
    );
  }

  // Swatch fallback: labelled colour swatches where colour is never the only indicator.
  return (
    <div className={cn('space-y-1.5', className)} data-testid="slot-visual-swatches">
      <ul aria-label="Colours" className="flex flex-wrap gap-2">
        {swatches.map((swatch, i) => (
          <li
            key={`${swatch.colorId}-${i}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
          >
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-full border border-foreground/20"
              style={{ backgroundColor: swatch.hex }}
            />
            {swatch.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
