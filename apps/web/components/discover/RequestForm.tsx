'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import type { ProfileSizes, RecommendationResponse } from '@styleme/contracts';
import { requestLooksAction, type LooksState } from '@/app/actions/discover';
import type { FormState } from '@/lib/actions';
import { requestFromDesign, type DesignRequest, type DesignSummary } from '@/lib/discover/design-summary';
import { uniqueLooks } from '@/lib/discover/results';
import { DesignSummaryCard } from '@/components/discover/DesignSummaryCard';
import { LookCard } from '@/components/outfits/LookCard';
import { RegenerateButton } from '@/components/outfits/RegenerateButton';
import { ResultFlags } from '@/components/outfits/ResultFlags';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// Discover My Style look request (FR-LOOK-01), built from Outfit Categories (D-132): the chosen saved design
// gives the garment to build around, the occasion (its occasion tag, else the occasion preferences, else
// Everyday) and the wear type (its outfit category). Colours come from My Colour Palette on the API side.

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

/** The looks of one request, in engine order (FR-LOOK-13), with the result flags first. */
function Results({ result, sizes }: { result: RecommendationResponse; sizes: ProfileSizes }) {
  const looks = uniqueLooks(result.looks);
  return (
    <section aria-labelledby="results-heading" className="space-y-4">
      <h2 id="results-heading" className="font-display text-2xl text-primary">
        Your looks
      </h2>
      {looks.length > 0 ? (
        // A new request starts a new regenerate state.
        <RegenerateButton key={result.recommendationId} outfitId={looks[0]!.id} sizes={sizes}>
          <ResultFlags result={result} />
          {looks.map((look, i) => (
            <LookCard key={look.id} look={look} position={i + 1} sizes={sizes} />
          ))}
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
function RequestSummary({ request, design }: { request: DesignRequest; design: DesignSummary }) {
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
        <dd>From My Colour Palette</dd>
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
}: {
  sizes: ProfileSizes;
  /** The user's saved Outfit Categories designs, newest first. */
  designs?: DesignSummary[];
  /** The design to start with (opened from the visual customizer); otherwise the newest saved one. */
  initialDesign?: string | null;
  /** Occasion feature IDs from the Outfit Categories preferences, used when a design has no occasion tag. */
  occasionPreferences?: readonly string[];
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
          <RequestSummary request={request} design={activeDesign} />
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
