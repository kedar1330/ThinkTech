'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  bodyMeasurement,
  measurementIllustrationPath,
  type BodyMeasurementId,
  type ClothingPreference,
  type MeasurementUnit,
  type MeasurementValues,
} from '@styleme/contracts';
import { saveMeasurementsAction } from '@/app/actions/measurements';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  buildMeasurementsRequest,
  checkEntry,
  convertEntries,
  entriesFrom,
  type Entries,
} from '@/lib/profile/measurement-form';
import { cn } from '@/lib/utils';

/**
 * Step-by-step measurement form (D-129): one measurement per step, with its illustration and how-to text,
 * a value in cm or inches, dots and a strip of every step. `required` (body type) needs every value;
 * otherwise steps can be skipped (fit). Saving sends all steps' values in centimetres.
 */
export function MeasurementStepper({
  department,
  ids,
  valuesCm,
  unit: initialUnit,
  required,
  heading,
  saveLabel,
  onSaved,
}: {
  department: ClothingPreference;
  ids: readonly BodyMeasurementId[];
  valuesCm: MeasurementValues;
  unit: MeasurementUnit;
  required: boolean;
  heading: string;
  saveLabel: string;
  onSaved?: (message: string) => void;
}) {
  const [unit, setUnit] = useState<MeasurementUnit>(initialUnit);
  const [entries, setEntries] = useState<Entries>(() => entriesFrom(valuesCm, ids, initialUnit));
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const id = ids[step]!;
  const m = bodyMeasurement(id);
  const last = step === ids.length - 1;

  function go(next: number) {
    setError(null);
    setStep(Math.max(0, Math.min(ids.length - 1, next)));
  }

  function nextStep() {
    const check = checkEntry(id, entries[id], unit);
    if (!check.ok) return setError(check.error);
    if (required && check.cm === undefined) return setError(`Add your ${m.label.toLowerCase()} to continue.`);
    if (!last) return go(step + 1);
    const built = buildMeasurementsRequest(ids, entries, unit, required);
    if (!built.ok) {
      setStep(built.step);
      return setError(built.error);
    }
    startTransition(async () => {
      const result = await saveMeasurementsAction(built.body);
      if (result.error) return setError(result.error);
      const message = required ? 'Measurements saved. Your body type is shown above.' : 'Fit measurements saved.';
      setSaved(message);
      onSaved?.(message);
    });
  }

  function switchUnit(next: MeasurementUnit) {
    setEntries((current) => convertEntries(current, unit, next));
    setUnit(next);
  }

  return (
    <section
      aria-label={heading}
      className="space-y-4 on-dark rounded-2xl bg-primary p-4 text-primary-foreground sm:p-6"
    >
      <div className="text-center">
        <h3 className="text-base font-semibold">{heading}</h3>
        <p className="text-sm text-white/70">
          Step {step + 1} of {ids.length}: {m.label}
        </p>
      </div>

      <div className="flex items-stretch gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => go(step - 1)}
          disabled={step === 0}
          aria-label="Previous measurement"
          className="flex w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 sm:w-10"
        >
          <ChevronLeft aria-hidden />
        </button>

        <div className="flex min-w-0 flex-1 flex-col items-center gap-3 rounded-xl border border-accent/40 bg-white/5 p-4">
          <h4 className="text-lg font-semibold">{m.label}</h4>
          <Image
            src={measurementIllustrationPath(department, id)}
            alt={`How to measure your ${m.label.toLowerCase()}`}
            width={160}
            height={240}
            unoptimized
            className="h-48 w-auto sm:h-56"
          />
          <p className="max-w-sm text-center text-sm text-white/85">
            <span className="font-medium">How to measure:</span> {m.howTo}
          </p>
          <p className="text-xs text-white/60">Used for: {m.usedFor}</p>

          <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
            <label className="sr-only" htmlFor={`m-${id}`}>
              {m.label} in {unit === 'cm' ? 'centimetres' : 'inches'}
            </label>
            <input
              id={`m-${id}`}
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={entries[id] ?? ''}
              placeholder={unit === 'cm' ? 'cm' : 'inches'}
              onChange={(e) => {
                setError(null);
                setEntries((current) => ({ ...current, [id]: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  nextStep();
                }
              }}
              className="h-10 w-28 rounded-lg border border-white/30 bg-white px-3 text-sm text-slate-900"
            />
            <div role="radiogroup" aria-label="Unit" className="flex rounded-full bg-white/10 p-0.5 text-xs">
              {(['cm', 'in'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  role="radio"
                  aria-checked={unit === u}
                  onClick={() => switchUnit(u)}
                  className={cn(
                    'rounded-full px-3 py-1.5',
                    unit === u ? 'bg-accent text-accent-foreground' : 'text-white/80',
                  )}
                >
                  {u === 'cm' ? 'cm' : 'Inches'}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" onClick={nextStep} disabled={pending} variant="accent">
              {pending ? 'Saving…' : last ? saveLabel : 'Next'}
            </Button>
            {!required && !last ? (
              <button type="button" onClick={() => go(step + 1)} className="text-xs text-white/70 underline">
                Skip
              </button>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go(step + 1)}
          disabled={last}
          aria-label="Next measurement"
          className="flex w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20 disabled:opacity-30 sm:w-10"
        >
          <ChevronRight aria-hidden />
        </button>
      </div>

      <div className="flex justify-center gap-1.5" aria-hidden>
        {ids.map((stepId, i) => (
          <span
            key={stepId}
            className={cn(
              'size-1.5 rounded-full',
              i === step ? 'bg-white' : entries[stepId] ? 'bg-accent' : 'bg-white/30',
            )}
          />
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {ids.map((stepId, i) => (
          <button
            key={stepId}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to ${bodyMeasurement(stepId).label}`}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex w-24 shrink-0 flex-col items-center gap-1 rounded-lg border bg-white/5 p-1.5 text-[11px] leading-tight',
              i === step ? 'border-white' : 'border-white/15 hover:border-white/40',
            )}
          >
            <Image
              src={measurementIllustrationPath(department, stepId)}
              alt=""
              width={60}
              height={90}
              unoptimized
              className="h-16 w-auto"
            />
            <span className="text-center">{bodyMeasurement(stepId).label}</span>
            {entries[stepId] ? (
              <span className="text-accent">
                {entries[stepId]} {unit}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved && !error ? <Alert tone="success">{saved}</Alert> : null}
    </section>
  );
}
