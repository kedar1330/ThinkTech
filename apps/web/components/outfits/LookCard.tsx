import Link from 'next/link';
import type { Look, ProfileSizes } from '@styleme/contracts';
import { shopHref } from '@/lib/shop/look-shopper';
import { Card } from '@/components/ui/card';
import { FeedbackButtons } from './FeedbackButtons';
import { SaveLookButton } from './SaveLookButton';
import { SlotRow } from './SlotRow';
import { WhyThisWorks } from './WhyThisWorks';

/**
 * One generated look (FR-LOOK), with Save (FR-OUT-01), Shop this look (#43) and Feedback (#42). Reused by explanations
 * and alternatives (#48) and slot visuals (#50).
 */
export function LookCard({ look, position, sizes }: { look: Look; position: number; sizes: ProfileSizes }) {
  const headingId = `look-${look.id}`;
  return (
    <Card className="p-4 sm:p-6">
      <article aria-labelledby={headingId} className="space-y-4">
        <h3 id={headingId} className="font-display text-xl text-primary">
          Look {position}
        </h3>
        <WhyThisWorks explanation={look.explanation} />
        <ul aria-label="Items in this look" className="space-y-3">
          {look.slots.map((slot) => (
            <SlotRow key={slot.slotId} slot={slot} sizes={sizes} />
          ))}
        </ul>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <SaveLookButton outfitId={look.id} saved={look.status === 'saved'} />
          <Link
            href={shopHref(look.id)}
            className="inline-flex min-h-11 items-center text-sm font-medium text-plum underline"
          >
            Shop this look
          </Link>
        </div>
        <FeedbackButtons outfitId={look.id} initialFeedback={look.feedback} />
      </article>
    </Card>
  );
}
