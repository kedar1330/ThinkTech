import { CATEGORIES, type Look } from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { lookTitle, slotLabel, specAttributes, vocabLabel } from '@/lib/outfits/look-text';
import { SwatchList } from './SwatchList';

// A look's details (FR-OUT-02): every piece with its named colours, what to look for, a phrase to
// search anywhere, the size note and why the look works. A saved look shows the snapshot stored when
// it was generated (FR-OUT-05).

export function LookDetail({ look }: { look: Look }) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Badge>{look.status === 'saved' ? 'Saved' : 'Not saved'}</Badge>
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{lookTitle(look)}</h1>
        {look.status !== 'saved' && (
          <Alert tone="info">This look isn’t saved yet. Suggested looks are removed 7 days after they are made.</Alert>
        )}
      </header>

      <section aria-labelledby="look-pieces" className="space-y-4">
        <h2 id="look-pieces" className="font-display text-2xl text-primary">
          The pieces
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {look.slots.map((slot) => (
            <li key={slot.slotId}>
              <Card className="h-full space-y-4 p-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {slotLabel(slot.slot)}
                  </p>
                  <h3 className="font-medium">{vocabLabel(CATEGORIES, slot.lookSpec.category)}</h3>
                </div>
                <SwatchList swatches={slot.swatches} />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {specAttributes(slot.lookSpec).map(({ term, value }) => (
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
                <p className="text-sm text-muted-foreground">{slot.sizeNote}</p>
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
