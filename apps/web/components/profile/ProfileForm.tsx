'use client';

import { useActionState, useState } from 'react';
import {
  AGE_GROUPS,
  CLOTHING_PREFERENCES,
  FABRICS,
  HEIGHT_CM_MAX,
  HEIGHT_CM_MIN,
  type ProfileResponse,
} from '@styleme/contracts';
import { saveProfileAction } from '@/app/actions/profile';
import type { FormState } from '@/lib/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldPrivacyNote } from '@/components/profile/FieldPrivacyNote';
import { cmToFeetInches } from '@/lib/profile/profile-form';
import { cn } from '@/lib/utils';

// My Profile basics (FR-PROF, D-129): the Clothing Preference (required; it decides which measurements and
// body types are shown), plus an optional height (D-131), age group, budget and fabrics. Colours, fit,
// contrast, silhouettes, coverage, comfort, styles and occasions are asked per outfit in Discover My Style
// and Shop My Look, not here.

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

function Section({ title, why, children }: { title: string; why: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-border bg-surface p-5">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <p className="text-xs text-muted-foreground">{why}</p>
      {children}
    </fieldset>
  );
}

/** Large selectable cards; the native radio stays in the form for keyboard and screen-reader use. */
function ChoiceCards({
  name,
  options,
  value,
  required,
}: {
  name: string;
  options: readonly { id: string; label: string; hint?: string }[];
  value: string | null;
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => (
        <label
          key={o.id}
          className={cn(
            'flex cursor-pointer flex-col gap-1 rounded-xl border border-input bg-surface px-4 py-3 transition-colors hover:border-plum/50',
            'has-[:checked]:border-plum has-[:checked]:bg-accent-soft/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              name={name}
              value={o.id}
              defaultChecked={value === o.id}
              required={required}
              className="accent-[var(--plum)]"
            />
            {o.label}
          </span>
          {o.hint ? <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span> : null}
        </label>
      ))}
    </div>
  );
}

/** Height in centimetres or in feet and inches; the form sends the unit and the parser converts to cm. */
function HeightField({ initialCm }: { initialCm: number | null }) {
  const [unit, setUnit] = useState<'ft_in' | 'cm'>('ft_in');
  const feetInches = initialCm === null ? null : cmToFeetInches(initialCm);
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Height unit" className="inline-flex rounded-full border border-input p-0.5">
        {(
          [
            ['ft_in', 'Feet & inches'],
            ['cm', 'Centimetres'],
          ] as const
        ).map(([id, label]) => (
          <label
            key={id}
            className="cursor-pointer rounded-full px-3 py-1 text-sm has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40"
          >
            <input
              type="radio"
              name="heightUnit"
              value={id}
              checked={unit === id}
              onChange={() => setUnit(id)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </div>
      {unit === 'ft_in' ? (
        <div className="flex items-center gap-2">
          <Input
            name="heightFt"
            type="number"
            inputMode="numeric"
            min={3}
            max={7}
            step={1}
            defaultValue={feetInches?.feet}
            aria-label="Height, feet"
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">ft</span>
          <Input
            name="heightIn"
            type="number"
            inputMode="numeric"
            min={0}
            max={11}
            step={1}
            defaultValue={feetInches?.inches}
            aria-label="Height, inches"
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">in</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            name="heightCm"
            type="number"
            inputMode="numeric"
            min={HEIGHT_CM_MIN}
            max={HEIGHT_CM_MAX}
            step={1}
            defaultValue={initialCm ?? undefined}
            aria-label="Height in centimetres"
            className="w-28"
          />
          <span className="text-sm text-muted-foreground">cm</span>
        </div>
      )}
    </div>
  );
}

type ProfileAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * `action` replaces the default save (onboarding saves and continues); `before` renders extra fields at the
 * top of the same form (onboarding asks Google sign-ups for their city there).
 */
export function ProfileForm({
  initial,
  action: submit = saveProfileAction,
  before,
  submitLabel = 'Save',
}: {
  initial: ProfileResponse;
  action?: ProfileAction;
  before?: React.ReactNode | ((state: FormState) => React.ReactNode);
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(submit, undefined);
  const department = initial.department === 'women' || initial.department === 'men' ? initial.department : null;

  return (
    <form action={action} className="space-y-5">
      {typeof before === 'function' ? before(state) : before}
      <Section
        title="Clothing preference (required)"
        why="Which clothes StyleMe suggests. It also decides which body measurements and body types you see below."
      >
        {initial.department === 'any' ? (
          <Alert tone="info">Please choose one: StyleMe now tailors measurements and body types to it.</Alert>
        ) : null}
        <ChoiceCards
          name="department"
          options={CLOTHING_PREFERENCES.map((c) => ({
            ...c,
            hint: c.id === 'women' ? 'Sarees, lehengas, kurtis, dresses and more' : 'Shirts, kurtas, suits and more',
          }))}
          value={department}
          required
        />
      </Section>

      <Section
        title="Height (recommended)"
        why="The most useful detail for good suggestions: it shapes the lengths, cuts and proportions we recommend. It never decides your size."
      >
        <HeightField initialCm={initial.heightCm} />
        <FieldPrivacyNote
          usedFor="Choosing garment lengths, cuts and proportions that suit your height, and, with a full-body photo, judging your body type."
          whoSees="Private to you. If you upload a full-body photo and agree, it is sent to Google Gemini with that photo, and with nothing else about you."
          howToDelete="Clear the field and save to remove it at any time. It is permanently removed if you delete your account."
        />
      </Section>

      <Section
        title="Age group (optional)"
        why="Helps keep suggestions age-appropriate. We never ask for your date of birth."
      >
        <div className="flex flex-wrap gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-input px-3 py-1.5 text-sm has-[:checked]:border-plum has-[:checked]:bg-accent-soft/50">
            <input type="radio" name="ageGroup" value="" defaultChecked={!initial.ageGroup} />
            Prefer not to say
          </label>
          {AGE_GROUPS.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-input px-3 py-1.5 text-sm has-[:checked]:border-plum has-[:checked]:bg-accent-soft/50"
            >
              <input type="radio" name="ageGroup" value={a.id} defaultChecked={initial.ageGroup === a.id} />
              {a.label}
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Budget per look (₹, optional)"
        why="Used only to compare against the total of prices you enter for items you find yourself. It never limits which looks you see."
      >
        <Input
          id="budgetPreference"
          name="budgetPreference"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000000}
          step={1}
          defaultValue={initial.budgetPreference ?? undefined}
          aria-label="Budget per look in rupees"
        />
        <FieldPrivacyNote
          usedFor="Comparing against the total of prices you enter for items you find yourself. It never limits which looks you see."
          whoSees="Private to you. Never shared with other users and never sent to external AI."
          howToDelete="You can change or clear this at any time by editing your profile. It is permanently removed if you delete your account."
        />
      </Section>

      <details className="group rounded-xl border border-border bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold">Fabrics you like or avoid (optional)</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Fabrics you like are favoured; fabrics you avoid never appear in your looks.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FABRICS.map((f) => {
            const value = initial.fabricPreferences.liked.includes(f.id)
              ? 'like'
              : initial.fabricPreferences.avoided.includes(f.id)
                ? 'avoid'
                : '';
            return (
              <label key={f.id} className="flex items-center justify-between gap-2 text-sm">
                {f.label}
                <select
                  name={`fabric_${f.id}`}
                  defaultValue={value}
                  className="h-8 rounded-md border border-input bg-surface px-2 text-sm"
                >
                  <option value="">—</option>
                  <option value="like">Like</option>
                  <option value="avoid">Avoid</option>
                </select>
              </label>
            );
          })}
        </div>
      </details>

      <Status state={state} />
      <Button size="full" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
