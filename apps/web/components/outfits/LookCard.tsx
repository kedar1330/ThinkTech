'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { Look, ProfileSizes } from '@styleme/contracts';
import { shopHref } from '@/lib/shop/look-shopper';
import { Card } from '@/components/ui/card';
import { garmentSlots } from '@/lib/outfits/look-text';
import { DesignMatchBadge } from './DesignMatchBadge';
import { FeedbackButtons } from './FeedbackButtons';
import { OutfitImage } from './OutfitImage';
import { SaveLookButton } from './SaveLookButton';
import { ShopLookButton } from './ShopLookButton';
import { SlotRow } from './SlotRow';
import { WhyThisWorks } from './WhyThisWorks';

/**
 * One generated look (FR-LOOK), with Save (FR-OUT-01), Shop this look (#43),
 * Change it in Design Studio (D-134) and Feedback (#42).
 * Formatted cleanly for 3-in-a-row display: image is prominent, and heavy technical
 * details are contained in a collapsible details section so cards remain uncluttered.
 */
export function LookCard({ look, position, sizes }: { look: Look; position: number; sizes: ProfileSizes }) {
  const headingId = `look-${look.id}`;
  const slots = garmentSlots(look);

  return (
    <Card className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-xs transition-shadow hover:shadow-md">
      <article aria-labelledby={headingId} className="flex flex-1 flex-col space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="font-display text-lg font-medium text-primary">
            Look {position}
          </h3>
          {look.designMatch && <DesignMatchBadge match={look.designMatch} />}
        </div>

        {look.image && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-surface-muted/30">
            <OutfitImage outfitId={look.id} ready={look.image === 'ready'} />
          </div>
        )}

        {/* Compact summary pill of main pieces & swatches */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {slots.map((slot) => {
            const swatch = slot.swatches[0];
            return (
              <span
                key={slot.slotId}
                className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-surface px-2.5 py-1 text-[11px] font-medium text-foreground shadow-2xs"
              >
                {swatch?.hex && (
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full border border-black/15"
                    style={{ backgroundColor: swatch.hex }}
                  />
                )}
                <span className="capitalize">
                  {swatch?.name ? `${swatch.name} ` : ''}
                  {slot.lookSpec.category.replace('_', ' ')}
                </span>
              </span>
            );
          })}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <SaveLookButton outfitId={look.id} saved={look.status === 'saved'} />
          {look.status === 'saved' ? (
            <Link
              href={shopHref(look.id)}
              className="inline-flex min-h-9 items-center rounded-full bg-plum/10 px-3 py-1.5 text-xs font-semibold text-plum hover:bg-plum/20 transition-colors"
            >
              Shop this look
            </Link>
          ) : (
            <ShopLookButton outfitId={look.id} />
          )}
        </div>

        {/* Collapsible Details to keep card clean and uncluttered in 3-in-a-row grid */}
        <details open className="group mt-auto pt-2 border-t border-border/60 text-xs">
          <summary className="flex cursor-pointer select-none items-center justify-between py-1.5 font-medium text-plum hover:underline">
            <span>Styling details &amp; garment specifications</span>
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180 text-muted-foreground" />
          </summary>
          <div className="mt-3 space-y-4 pt-2 border-t border-dashed border-border/60">
            <WhyThisWorks explanation={look.explanation} />
            <ul aria-label="Items in this look" className="space-y-3">
              {slots.map((slot) => (
                <SlotRow key={slot.slotId} slot={slot} sizes={sizes} />
              ))}
            </ul>
            <div className="pt-2">
              <Link
                href={`/design-studio?look=${look.id}`}
                className="inline-flex min-h-9 items-center text-xs font-medium text-plum underline hover:text-plum/80"
              >
                Change it in Design Studio
              </Link>
            </div>
            <FeedbackButtons outfitId={look.id} initialFeedback={look.feedback} />
          </div>
        </details>
      </article>
    </Card>
  );
}
