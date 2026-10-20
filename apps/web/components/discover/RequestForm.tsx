'use client';

import { startTransition, useActionState, useRef } from 'react';
import {
  OCCASIONS,
  PALETTE_MODES,
  STYLES,
  WEAR_TYPES,
  type PaletteMode,
  type ProfileSizes,
  type RecommendationResponse,
} from '@styleme/contracts';
import { requestLooksAction, type LooksState } from '@/app/actions/discover';
import type { FormState } from '@/lib/actions';
import { uniqueLooks } from '@/lib/discover/results';
import { LookCard } from '@/components/outfits/LookCard';
import { RegenerateButton } from '@/components/outfits/RegenerateButton';
import { ResultFlags } from '@/components/outfits/ResultFlags';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

// Discover My Style look request (FR-LOOK-01). Only the occasion is required; option labels come from
// the shared vocabulary.

const select =
  'flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

const PALETTE_MODE_TEXT: Record<PaletteMode, { label: string; hint: string }> = {
  suggested: { label: 'Suggested for me', hint: 'Colours from the palette chosen for each look.' },
  explore: { label: 'Explore', hint: "Wider choices: any colour you haven't marked to avoid." },
};

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
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

export function RequestForm({ sizes }: { sizes: ProfileSizes }) {
  // The last request, so Retry can send it again after the form has been reset.
  const lastRequest = useRef<FormData | null>(null);
  const [state, action, pending] = useActionState((prev: LooksState, formData: FormData) => {
    lastRequest.current = formData;
    return requestLooksAction(prev, formData);
  }, undefined);
  const errors = state?.fieldErrors ?? {};
  const retry = () => {
    const request = lastRequest.current;
    if (request) startTransition(() => action(request));
  };

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-6" noValidate>
        <fieldset className="space-y-3" aria-describedby={errors.occasion ? 'occasion-error' : undefined}>
          <legend className="text-sm font-semibold">Occasion (required)</legend>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-4">
            {OCCASIONS.map((o) => (
              <label
                key={o.id}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring/30 has-[:checked]:border-plum has-[:checked]:bg-plum/5"
              >
                <input type="radio" name="occasion" value={o.id} required aria-invalid={Boolean(errors.occasion)} />
                {o.label}
              </label>
            ))}
          </div>
          <FieldError id="occasion-error" message={errors.occasion} />
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="style">
            Style <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </Label>
          <select
            id="style"
            name="style"
            defaultValue=""
            className={select}
            aria-invalid={Boolean(errors.style)}
            aria-describedby={errors.style ? 'style-error' : undefined}
          >
            <option value="">Any style</option>
            {STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <FieldError id="style-error" message={errors.style} />
        </div>

        <fieldset className="space-y-2" aria-describedby={errors.wearType ? 'wearType-error' : 'wearType-hint'}>
          <legend className="text-sm font-medium">
            Wear type <span className="ml-1 font-normal text-muted-foreground">(optional)</span>
          </legend>
          <p id="wearType-hint" className="text-xs text-muted-foreground">
            Only looks of the types you tick are shown. Leave all unticked to see every type.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {WEAR_TYPES.map((w) => (
              <label key={w.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" name="wearType" value={w.id} />
                {w.label}
              </label>
            ))}
          </div>
          <FieldError id="wearType-error" message={errors.wearType} />
        </fieldset>

        <fieldset className="space-y-2" aria-describedby={errors.paletteMode ? 'paletteMode-error' : undefined}>
          <legend className="text-sm font-medium">Colours</legend>
          <div className="flex flex-col gap-2">
            {PALETTE_MODES.map((m) => (
              <label key={m} className="flex items-start gap-2 text-sm">
                <input type="radio" name="paletteMode" value={m} defaultChecked={m === 'suggested'} className="mt-1" />
                <span>
                  {PALETTE_MODE_TEXT[m].label}
                  <span className="block text-xs text-muted-foreground">{PALETTE_MODE_TEXT[m].hint}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldError id="paletteMode-error" message={errors.paletteMode} />
        </fieldset>

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
      {state?.result && <Results result={state.result} sizes={sizes} />}
    </div>
  );
}
