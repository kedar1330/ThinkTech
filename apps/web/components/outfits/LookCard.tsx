import type { Look, ProfileSizes } from '@styleme/contracts';
import { Card } from '@/components/ui/card';
import { SlotRow } from './SlotRow';

/**
 * One generated look (FR-LOOK). Reused by saved looks (#41), explanations and alternatives (#48) and
 * slot visuals (#50). Save, Shop this look and Regenerate are added when #41, #43 and #49 exist.
 */
export function LookCard({ look, position, sizes }: { look: Look; position: number; sizes: ProfileSizes }) {
  const headingId = `look-${look.id}`;
  return (
    <Card className="p-4 sm:p-6">
      <article aria-labelledby={headingId} className="space-y-4">
        <h3 id={headingId} className="font-display text-xl text-primary">
          Look {position}
        </h3>
        <p className="text-sm">{look.explanation}</p>
        <ul aria-label="Items in this look" className="space-y-3">
          {look.slots.map((slot) => (
            <SlotRow key={slot.slotId} slot={slot} sizes={sizes} />
          ))}
        </ul>
      </article>
    </Card>
  );
}
