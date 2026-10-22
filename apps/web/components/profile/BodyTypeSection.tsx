'use client';

import { useState, useTransition } from 'react';
import {
  BODY_TYPE_DESCRIPTIONS,
  MEASUREMENT_ORDER,
  bodyTypeLabel,
  bodyTypesFor,
  type AppearanceResponse,
  type BodyType,
  type ClothingPreference,
  type MeasurementsResponse,
} from '@styleme/contracts';
import { confirmAppearanceAction, saveBodyTypeAction } from '@/app/actions/appearance';
import type { FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { ModeChoice, SourceLine, Status, type EntryMode } from '@/components/profile/AppearanceShared';
import { MeasurementStepper } from '@/components/profile/MeasurementStepper';
import { PhotoUpload } from '@/components/profile/PhotoUpload';
import { cn } from '@/lib/utils';

// Body type (D-129). The user enters the body-type measurements for their Clothing Preference, or — if they
// don't have them, or want to try clothes on a 2D/3D model later — uploads a full-body photo that Gemini
// analyses. Either way the result appears at once and can be confirmed or corrected. Fit measurements are a
// separate, optional, hidden-by-default part.

function BodyTypePicker({
  department,
  current,
  onSaved,
}: {
  department: ClothingPreference;
  current: BodyType | null;
  onSaved: (state: FormState) => void;
}) {
  const [picked, setPicked] = useState<BodyType | null>(current);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Choose your body type</p>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Body type">
        {bodyTypesFor(department).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={picked === id}
            onClick={() => setPicked(id)}
            className={cn(
              'rounded-xl border border-input bg-surface px-4 py-3 text-left transition-colors hover:border-plum/50',
              picked === id && 'border-plum bg-accent-soft/50',
            )}
          >
            <span className="block text-sm font-medium">{bodyTypeLabel(id)}</span>
            <span className="block text-xs text-muted-foreground">{BODY_TYPE_DESCRIPTIONS[id]}</span>
          </button>
        ))}
      </div>
      <Button
        type="button"
        size="full"
        disabled={!picked || pending}
        onClick={() => startTransition(async () => onSaved(await saveBodyTypeAction(picked!)))}
      >
        {pending ? 'Saving…' : 'Save body type'}
      </Button>
    </div>
  );
}

export function BodyTypeSection({
  department,
  appearance,
  measurements,
  analysisAvailable,
}: {
  department: ClothingPreference | null;
  appearance: AppearanceResponse;
  measurements: MeasurementsResponse;
  analysisAvailable: boolean;
}) {
  const bodyType = appearance.bodyType;
  const [mode, setMode] = useState<EntryMode | null>(
    bodyType?.source === 'photo_estimate'
      ? 'photo'
      : bodyType || Object.keys(measurements.valuesCm).length
        ? 'manual'
        : null,
  );
  const [correcting, setCorrecting] = useState(false);
  const [state, setState] = useState<FormState>(undefined);
  const [pending, startTransition] = useTransition();

  if (!department) {
    return (
      <p className="rounded-xl border border-dashed border-input p-4 text-sm text-muted-foreground">
        Choose your clothing preference above first: the measurements and body types depend on it.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {bodyType ? (
        <div className="space-y-3 rounded-xl border border-plum/30 bg-accent-soft/40 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-plum">Your body type</p>
          <p className="font-display text-2xl text-primary">{bodyTypeLabel(bodyType.value)}</p>
          <p className="text-sm text-muted-foreground">{BODY_TYPE_DESCRIPTIONS[bodyType.value]}</p>
          <SourceLine attribute={bodyType} />
          <p className="text-xs text-muted-foreground">
            A flexible styling reference, never a judgement. It never sets your size.
          </p>
          <div className="flex flex-wrap gap-2">
            {!bodyType.userConfirmed ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(async () => setState(await confirmAppearanceAction(['bodyType'])))}
              >
                Yes, that’s right
              </Button>
            ) : null}
            <Button type="button" size="sm" variant="outline" onClick={() => setCorrecting((c) => !c)}>
              {correcting ? 'Cancel' : bodyType.userConfirmed ? 'Change' : 'Correct it'}
            </Button>
          </div>
          {correcting ? (
            <BodyTypePicker
              department={department}
              current={bodyType.value}
              onSaved={(s) => {
                setState(s);
                if (s?.success) setCorrecting(false);
              }}
            />
          ) : null}
        </div>
      ) : null}

      <ModeChoice
        mode={mode}
        onChange={(m) => {
          setMode(m);
          setState(undefined);
        }}
        photoLabel="Upload a full-body photo"
        manualLabel="Enter my measurements"
        photoAvailable={analysisAvailable}
      />

      {mode === 'manual' ? (
        <div className="space-y-3">
          <MeasurementStepper
            key={`${department}-body`}
            department={department}
            ids={MEASUREMENT_ORDER[department].body_type}
            valuesCm={measurements.valuesCm}
            unit={measurements.displayUnit}
            required
            heading={`Required measurements — ${department === 'women' ? 'Women' : 'Men'}`}
            saveLabel="Save & see my body type"
          />
          {!bodyType ? (
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer text-sm font-medium">I know my body type — choose it instead</summary>
              <div className="mt-3">
                <BodyTypePicker department={department} current={null} onSaved={setState} />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      {mode === 'photo' ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            No measurements to hand? A full-body photo works too. It is also kept for trying clothes on your 2D or 3D
            model later.
          </p>
          <PhotoUpload kind="body" />
        </div>
      ) : null}

      <Status state={state} />

      <details className="group rounded-xl border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Add fit measurements (optional) — for clothes that fit you
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Only needed if you want help with fitting clothes. Skip any you don’t have; you can add them later.
        </p>
        <div className="mt-3">
          <MeasurementStepper
            key={`${department}-fit`}
            department={department}
            ids={MEASUREMENT_ORDER[department].fit}
            valuesCm={measurements.valuesCm}
            unit={measurements.displayUnit}
            required={false}
            heading={`Fit measurements — ${department === 'women' ? 'Women' : 'Men'}`}
            saveLabel="Save fit measurements"
          />
        </div>
      </details>
    </div>
  );
}
