'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import { STYLING_GOALS, type ProfileSizes, type RecommendationResponse } from '@styleme/contracts';
import { requestLooksAction, type LooksState } from '@/app/actions/discover';
import type { FormState } from '@/lib/actions';
import { requestFromDesign, type DesignRequest, type DesignSummary } from '@/lib/discover/design-summary';
import { uniqueLooks } from '@/lib/discover/results';
import { DesignSummaryCard } from './DesignSummaryCard';
import { LookCard } from '../outfits/LookCard';
import { RegenerateButton } from '../outfits/RegenerateButton';
import { ResultFlags } from '../outfits/ResultFlags';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// Discover My Style look request (FR-LOOK-01), built from Outfit Categories (D-132): the chosen saved design
// gives the garment to build around, the occasion (its occasion tag, else the occasion preferences, else
// Everyday) and the wear type (its outfit category). Colours come from My Colour Palette on the API side,
// or custom colours selected by user for this style.

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

/** The looks of one request, in engine order (FR-LOOK-13), shown cleanly 3 in a row. */
function Results({ result, sizes }: { result: RecommendationResponse; sizes: ProfileSizes }) {
  const looks = uniqueLooks(result.looks);
  return (
    <section aria-labelledby="results-heading" className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <h2 id="results-heading" className="font-display text-2xl text-primary">
          Your looks
        </h2>
        <span className="text-xs text-muted-foreground">
          {looks.length} outfit{looks.length === 1 ? '' : 's'} curated for you
        </span>
      </div>
      {looks.length > 0 ? (
        // A new request starts a new regenerate state.
        <RegenerateButton key={result.recommendationId} outfitId={looks[0]!.id} sizes={sizes}>
          <ResultFlags result={result} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {looks.map((look, i) => (
              <LookCard key={look.id} look={look} position={i + 1} sizes={sizes} />
            ))}
          </div>
        </RegenerateButton>
      ) : (
        <ResultFlags result={result} />
      )}
    </section>
  );
}

/** The user's other saved Outfit Categories designs, to build the looks around instead. */
function DesignChoices({
  designs,
  active,
  onChoose,
}: {
  designs: DesignSummary[];
  active: DesignSummary | null;
  onChoose: (garmentType: string) => void;
}) {
  const others = designs.filter((d) => d !== active);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="design-choices-heading" className="space-y-2">
      <h2 id="design-choices-heading" className="text-sm font-semibold">
        {active ? 'Or build looks around another saved design' : 'Build looks around a design from Outfit Categories'}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {others.map((d) => (
          <li key={d.garmentType}>
            <button
              type="button"
              onClick={() => onChoose(d.garmentType)}
              className="flex min-h-11 w-full flex-col items-start rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="font-medium">
                {d.garmentName} · {d.outfitLabel}
              </span>
              <span className="text-xs text-muted-foreground">{d.features.join(', ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const OCCASION_NOTE: Record<DesignRequest['occasionSource'], string | null> = {
  design: null,
  preference: 'From your occasion preferences in Outfit Categories.',
  default: 'No occasion chosen in Outfit Categories. Add an occasion tag to your design to change it.',
};

/** What the request will use, all taken from Outfit Categories and My Colour Palette. */
function RequestSummary({
  request,
  design,
  stylingGoals = [],
  customColors = [],
}: {
  request: DesignRequest;
  design: DesignSummary;
  stylingGoals?: readonly string[];
  customColors?: readonly string[];
}) {
  const note = OCCASION_NOTE[request.occasionSource];
  return (
    <section aria-labelledby="request-summary-heading" className="space-y-3 rounded-2xl border border-border p-4">
      <h2 id="request-summary-heading" className="text-sm font-semibold">
        From Outfit Categories
      </h2>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Occasion</dt>
        <dd>
          {request.occasionLabel}
          {note && <span className="block text-xs text-muted-foreground">{note}</span>}
        </dd>
        <dt className="text-muted-foreground">Wear type</dt>
        <dd>{request.wearTypeLabel}</dd>
        <dt className="text-muted-foreground">Colours</dt>
        <dd>
          {customColors.length > 0 ? (
            <span className="space-y-0.5">
              <span className="font-medium text-plum">{customColors.join(', ')}</span>
              <span className="block text-xs text-muted-foreground">
                (Your chosen colours for this style)
              </span>
            </span>
          ) : (
            <span className="space-y-0.5">
              <span>All harmonious colours</span>
              <span className="block text-xs text-muted-foreground">
                Harmonious shades &amp; combinations logically selected for this dress and occasion.
              </span>
            </span>
          )}
        </dd>
        {stylingGoals.length > 0 && (
          <>
            <dt className="text-muted-foreground">Styling goals</dt>
            <dd>
              <span className="flex flex-wrap gap-1.5 pt-0.5">
                {stylingGoals.map((id) => {
                  const goal = STYLING_GOALS.find((g) => g.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-foreground"
                    >
                      {goal?.label ?? id}
                    </span>
                  );
                })}
              </span>
            </dd>
          </>
        )}
      </dl>
      <Link
        href={`/categories/design/${design.garmentType}?outfit=${design.outfitCategory}`}
        className="inline-flex min-h-11 items-center text-sm text-plum underline"
      >
        Change these in Outfit Categories
      </Link>
    </section>
  );
}

export function RequestForm({
  sizes,
  designs = [],
  initialDesign = null,
  occasionPreferences = [],
  stylingGoals = [],
  customColors = [],
  customColorHexes = [],
}: {
  sizes: ProfileSizes;
  /** The user's saved Outfit Categories designs, newest first. */
  designs?: DesignSummary[];
  /** The design to start with (opened from the visual customizer); otherwise the newest saved one. */
  initialDesign?: string | null;
  /** Occasion feature IDs from the Outfit Categories preferences, used when a design has no occasion tag. */
  occasionPreferences?: readonly string[];
  /** Styling goals saved in Outfit Categories / Design Preferences. */
  stylingGoals?: readonly string[];
  /** Custom colours selected specifically for this request. */
  customColors?: string[];
  customColorHexes?: string[];
}) {
  // The last request, so Retry can send it again.
  const lastRequest = useRef<FormData | null>(null);
  const [chosen, setChosen] = useState<string | null>(initialDesign ?? designs[0]?.garmentType ?? null);
  const activeDesign = designs.find((d) => d.garmentType === chosen) ?? null;
  const request = activeDesign ? requestFromDesign(activeDesign, occasionPreferences) : null;
  const [state, action, pending] = useActionState((prev: LooksState, formData: FormData) => {
    lastRequest.current = formData;
    return requestLooksAction(prev, formData);
  }, undefined);
  const retry = () => {
    const last = lastRequest.current;
    if (last) startTransition(() => action(last));
  };

  if (designs.length === 0) {
    return (
      <section
        aria-labelledby="no-design-heading"
        className="space-y-3 rounded-2xl border border-dashed border-border p-6"
      >
        <h2 id="no-design-heading" className="font-display text-xl text-primary">
          Start with a design
        </h2>
        <p className="text-sm text-muted-foreground">
          Discover My Style builds looks around a garment you design in Outfit Categories, with its occasion and wear
          type. Choose a garment there, pick its neckline, sleeves and occasion, and save it.
        </p>
        <Link
          href="/categories"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Go to Outfit Categories
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {activeDesign && <DesignSummaryCard design={activeDesign} />}
      <DesignChoices designs={designs} active={activeDesign} onChoose={setChosen} />
      {activeDesign && request && (
        <form action={action} className="space-y-6" noValidate>
          <input type="hidden" name="designGarment" value={activeDesign.garmentType} />
          <input type="hidden" name="designOutfit" value={activeDesign.outfitCategory} />
          <input type="hidden" name="occasion" value={request.occasion} />
          <input type="hidden" name="wearType" value={request.wearType} />
          <input type="hidden" name="paletteMode" value="suggested" />
          {customColors.length > 0 && (
            <input type="hidden" name="customColors" value={customColors.join(',')} />
          )}
          {customColorHexes.length > 0 && (
            <input type="hidden" name="customColorHexes" value={customColorHexes.join(',')} />
          )}
          <RequestSummary
            request={request}
            design={activeDesign}
            stylingGoals={stylingGoals}
            customColors={customColors}
          />
          <Status state={state} />
          {state?.error && !state.fieldErrors && (
            <Button type="button" variant="outline" size="full" onClick={retry} disabled={pending}>
              Retry
            </Button>
          )}
          <Button size="full" disabled={pending}>
            {pending ? (
              <>
                <Spinner /> Finding looks…
              </>
            ) : (
              'Show me looks'
            )}
          </Button>
        </form>
      )}
      {state?.result && <Results result={state.result} sizes={sizes} />}
    </div>
  );
}
