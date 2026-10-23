'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import Link from 'next/link';
import type { MyColourCombinationsResponse, ProfileSizes, RecommendationResponse } from '@styleme/contracts';
import { CHOSEN_COLOURS_MAX } from '@styleme/contracts';
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
// Everyday) and the wear type (its outfit category). Colours for the outfit image come from (priority order):
//   1. Colours the user explicitly picks here (optional, up to CHOSEN_COLOURS_MAX).
//   2. Coordinating / combination colours from their palette (API resolves this automatically).
//   3. Liked colours from My Colour Palette.

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

/** A palette colour entry used in the colour picker. */
interface PickableColour {
  colourId: string;
  name: string;
  hex: string;
  preference: 'liked' | 'avoided' | null;
}

/**
 * Optional colour picker for the outfit image — lets the user select up to CHOSEN_COLOURS_MAX colours
 * from their palette. When nothing is picked the API uses coordinating/combination colours automatically.
 */
function ColourPicker({
  colours,
  chosen,
  onToggle,
}: {
  colours: PickableColour[];
  chosen: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const atLimit = chosen.size >= CHOSEN_COLOURS_MAX;

  return (
    <section
      aria-labelledby="colour-picker-heading"
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="colour-picker-heading" className="text-sm font-semibold">
            Choose colours for your outfit image
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional — pick up to {CHOSEN_COLOURS_MAX} colours. Leave empty to use your coordinating palette colours
            automatically.
          </p>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="colour-picker-grid"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium hover:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {open ? 'Hide' : chosen.size > 0 ? `${chosen.size} chosen` : 'Choose'}
        </button>
      </div>

      {/* Chosen colour chips — always visible when something is picked */}
      {chosen.size > 0 && (
        <ul aria-label="Chosen colours" className="flex flex-wrap gap-1.5">
          {colours
            .filter((c) => chosen.has(c.colourId))
            .map((c) => (
              <li key={c.colourId}>
                <button
                  type="button"
                  aria-label={`Remove ${c.name}`}
                  onClick={() => onToggle(c.colourId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-plum/60 bg-plum/5 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-plum/10"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full border border-foreground/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                  <span aria-hidden className="ml-0.5 text-muted-foreground">
                    ×
                  </span>
                </button>
              </li>
            ))}
          <li>
            <button
              type="button"
              onClick={() => colours.filter((c) => chosen.has(c.colourId)).forEach((c) => onToggle(c.colourId))}
              className="inline-flex min-h-7 items-center rounded-full px-2 text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear all
            </button>
          </li>
        </ul>
      )}

      {/* Expandable colour grid */}
      {open && (
        <div id="colour-picker-grid">
          {atLimit && (
            <p className="mb-2 text-xs text-muted-foreground" role="status">
              Maximum {CHOSEN_COLOURS_MAX} colours. Remove one to add another.
            </p>
          )}
          <ul className="flex flex-wrap gap-2" aria-label="Your palette colours">
            {colours.map((c) => {
              const isChosen = chosen.has(c.colourId);
              const disabled = atLimit && !isChosen;
              return (
                <li key={c.colourId}>
                  <button
                    type="button"
                    aria-pressed={isChosen}
                    disabled={disabled}
                    onClick={() => onToggle(c.colourId)}
                    title={c.name}
                    className={[
                      'group relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
                      isChosen
                        ? 'border-plum shadow-md shadow-plum/20 scale-110'
                        : disabled
                          ? 'border-border opacity-40 cursor-not-allowed'
                          : 'border-border hover:border-plum/60 hover:scale-105',
                    ].join(' ')}
                  >
                    <span
                      className="size-7 rounded-full border border-foreground/10"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden
                    />
                    {isChosen && (
                      <span
                        aria-hidden
                        className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-plum text-[9px] text-white"
                      >
                        ✓
                      </span>
                    )}
                    <span className="sr-only">
                      {c.name}
                      {isChosen ? ' (chosen)' : ''}
                      {c.preference === 'liked' ? ' · liked' : c.preference === 'avoided' ? ' · avoided' : ''}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {colours.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No palette colours yet.{' '}
              <Link href="/palette/colours" className="text-plum underline">
                Choose colours in My Colour Palette
              </Link>{' '}
              to enable this.
            </p>
          )}
        </div>
      )}

      {/* Hidden form inputs for chosen colours */}
      {[...chosen].map((id) => (
        <input key={id} type="hidden" name="chosenColours" value={id} />
      ))}
    </section>
  );
}

export function RequestForm({
  sizes,
  designs = [],
  initialDesign = null,
  occasionPreferences = [],
  paletteColours = null,
}: {
  sizes: ProfileSizes;
  /** The user's saved Outfit Categories designs, newest first. */
  designs?: DesignSummary[];
  /** The design to start with (opened from the visual customizer); otherwise the newest saved one. */
  initialDesign?: string | null;
  /** Occasion feature IDs from the Outfit Categories preferences, used when a design has no occasion tag. */
  occasionPreferences?: readonly string[];
  /** Coordinating and combination colours from the user's palette, for the optional colour picker. */
  paletteColours?: MyColourCombinationsResponse | null;
}) {
  // The last request, so Retry can send it again.
  const lastRequest = useRef<FormData | null>(null);
  const [chosen, setChosen] = useState(initialDesign ?? designs[0]?.garmentType ?? null);
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

  // Colour picker state — which CLR-XXXX IDs the user has explicitly chosen.
  const [chosenColours, setChosenColours] = useState<Set<string>>(new Set());
  const toggleColour = (id: string) =>
    setChosenColours((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < CHOSEN_COLOURS_MAX) next.add(id);
      return next;
    });

  // Build the flat list of pickable colours from the combination data (non-avoided, best first).
  const pickableColours: PickableColour[] = (paletteColours?.colours ?? [])
    .filter((c) => c.preference !== 'avoided')
    .map((c) => ({ colourId: c.colourId, name: c.name, hex: c.hex, preference: c.preference }));

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
          {/* Optional colour picker — only shown when the user has palette colours */}
          {(pickableColours.length > 0 || paletteColours !== null) && (
            <ColourPicker colours={pickableColours} chosen={chosenColours} onToggle={toggleColour} />
          )}
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
