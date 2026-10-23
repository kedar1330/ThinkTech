import Link from 'next/link';
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
 * One generated look (FR-LOOK), with Save (FR-OUT-01), Shop this look (#43; it saves the look first, #115),
 * Change it in Design Studio (D-134) and Feedback (#42). Reused by explanations
 * and alternatives (#48) and slot visuals (#50).
 */
export function LookCard({ look, position, sizes }: { look: Look; position: number; sizes: ProfileSizes }) {
  const headingId = `look-${look.id}`;
  return (
    <Card className="p-4 sm:p-6">
      <article aria-labelledby={headingId} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={headingId} className="font-display text-xl text-primary">
            Look {position}
          </h3>
          {look.designMatch && <DesignMatchBadge match={look.designMatch} />}
        </div>
        {look.image && <OutfitImage outfitId={look.id} ready={look.image === 'ready'} />}
        <WhyThisWorks explanation={look.explanation} />
        <ul aria-label="Items in this look" className="space-y-3">
          {garmentSlots(look).map((slot) => (
            <SlotRow key={slot.slotId} slot={slot} sizes={sizes} />
          ))}
        </ul>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <SaveLookButton outfitId={look.id} saved={look.status === 'saved'} />
          {look.status === 'saved' ? (
            <Link
              href={shopHref(look.id)}
              className="inline-flex min-h-11 items-center text-sm font-medium text-plum underline"
            >
              Shop this look
            </Link>
          ) : (
            <ShopLookButton outfitId={look.id} />
          )}
          <Link
            href={`/design-studio?look=${look.id}`}
            className="inline-flex min-h-11 items-center text-sm font-medium text-plum underline"
          >
            Change it in Design Studio
          </Link>
        </div>
        <FeedbackButtons outfitId={look.id} initialFeedback={look.feedback} />
      </article>
    </Card>
  );
}
