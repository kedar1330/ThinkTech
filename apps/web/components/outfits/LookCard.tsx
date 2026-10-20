import type { Look, ProfileSizes } from '@styleme/contracts';
import { Card } from '@/components/ui/card';
import { SaveLookButton } from './SaveLookButton';
import { SlotRow } from './SlotRow';
import { WhyThisWorks } from './WhyThisWorks';

/**
 * One generated look (FR-LOOK), with Save (FR-OUT-01). Reused by explanations and alternatives (#48)
 * and slot visuals (#50). Shop this look is added when #43 exists.
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
        <SaveLookButton outfitId={look.id} saved={look.status === 'saved'} />
      </article>
    </Card>
  );
}
