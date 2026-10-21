'use client';

import { useState } from 'react';
import { CATEGORIES, type Look, type ProfileSizes } from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { lookTitle, slotLabel, specAttributes, vocabLabel } from '@/lib/outfits/look-text';
import { FeedbackButtons } from './FeedbackButtons';
import { SavedAlternatives } from './SavedAlternatives';
import { SizeNote } from './SizeNote';
import { SlotVisual } from './SlotVisual';

// A look's details (FR-OUT-02, issue #42): every piece with its named colours, what to look for,
// a phrase to search anywhere, the size note, why the look works, feedback buttons and an
// Alternatives tab with refreshable alternatives.

export function LookDetail({ look, sizes }: { look: Look; sizes: ProfileSizes }) {
  const [tab, setTab] = useState<'pieces' | 'alternatives'>('pieces');

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <Badge>{look.status === 'saved' ? 'Saved' : 'Not saved'}</Badge>
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{lookTitle(look)}</h1>
        {look.status !== 'saved' && (
          <Alert tone="info">This look isn’t saved yet. Suggested looks are removed 7 days after they are made.</Alert>
        )}
        <FeedbackButtons outfitId={look.id} initialFeedback={look.feedback} />
      </header>

      <div
        role="tablist"
        aria-label="Look view"
        className="inline-flex rounded-lg border border-border bg-surface-muted/50 p-1"
      >
        <button
          type="button"
          role="tab"
          id="tab-pieces"
          aria-selected={tab === 'pieces'}
          aria-controls="panel-pieces"
          onClick={() => setTab('pieces')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            tab === 'pieces' ? 'bg-plum text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          The pieces
        </button>
        <button
          type="button"
          role="tab"
          id="tab-alternatives"
          aria-selected={tab === 'alternatives'}
          aria-controls="panel-alternatives"
          onClick={() => setTab('alternatives')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
            tab === 'alternatives' ? 'bg-plum text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Alternatives
        </button>
      </div>

      {tab === 'pieces' ? (
        <div id="panel-pieces" role="tabpanel" aria-labelledby="tab-pieces" className="space-y-8">
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
                    <SlotVisual swatches={slot.swatches} illustration={slot.illustration} />
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
        </div>
      ) : (
        <div id="panel-alternatives" role="tabpanel" aria-labelledby="tab-alternatives">
          <SavedAlternatives outfitId={look.id} slots={look.slots} />
        </div>
      )}
    </article>
  );
}
