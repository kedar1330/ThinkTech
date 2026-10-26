import { CATEGORIES, type Look, type ProfileSizes } from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { garmentSlots, lookTitle, slotGarmentName, slotLabel, specAttributes, vocabLabel } from '@/lib/outfits/look-text';
import { DesignMatchBadge } from './DesignMatchBadge';
import { FeedbackButtons } from './FeedbackButtons';
import { OutfitImage } from './OutfitImage';
import { SizeNote } from './SizeNote';
import { SlotVisual } from './SlotVisual';

// A look's details (FR-OUT-02, issue #42): every piece with its named colours, what to look for,
// a phrase to search anywhere, the size note, why the look works and feedback buttons.

export function LookDetail({ look, sizes }: { look: Look; sizes: ProfileSizes }) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Badge>{look.status === 'saved' ? 'Saved' : 'Not saved'}</Badge>
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{lookTitle(look)}</h1>
        {look.designMatch && <DesignMatchBadge match={look.designMatch} />}
        {look.image && <OutfitImage outfitId={look.id} ready={look.image === 'ready'} />}
        {look.status !== 'saved' && (
          <Alert tone="info">This look isn’t saved yet. Suggested looks are removed 7 days after they are made.</Alert>
        )}
        <FeedbackButtons outfitId={look.id} initialFeedback={look.feedback} />
      </header>

      <section aria-labelledby="look-pieces" className="space-y-4">
        <h2 id="look-pieces" className="font-display text-2xl text-primary">
          The pieces
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {garmentSlots(look).map((slot) => (
            <li key={slot.slotId}>
              <Card className="h-full space-y-4 p-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {slotLabel(slot.slot)}
                  </p>
                  <h3 className="font-medium">{slotGarmentName(slot)}</h3>
                </div>
                <SlotVisual swatches={slot.swatches} illustration={slot.illustration} />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {specAttributes(slot.lookSpec, slot).map(({ term, value }) => (
                    <div key={term} className="contents">
                      <dt className="text-muted-foreground">{term}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-sm">
                  <span className="text-muted-foreground">Search for: </span>
                  {slot.searchPhrase}
                </p>
                <SizeNote category={slot.lookSpec.category} sizes={sizes} />
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="look-why" className="space-y-2">
        <h2 id="look-why" className="font-display text-2xl text-primary">
          Why this works
        </h2>
        <p className="text-sm leading-relaxed">{look.explanation}</p>
      </section>
    </article>
  );
}
