'use client';

import { useActionState } from 'react';
import {
  COLORS,
  COMFORT_OPTIONS,
  CONTRAST_PREFERENCES,
  DEPARTMENTS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  LETTER_SIZES,
  NECKLINE_DEPTHS,
  OCCASIONS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  STYLES,
  type ProfileResponse,
} from '@styleme/contracts';
import { saveProfileAction } from '@/app/actions/profile';
import type { FormState } from '@/lib/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldPrivacyNote } from '@/components/profile/FieldPrivacyNote';

// Style profile form (FR-PROF-02 … 05, FR-SIZE-01/02). Every field explains why it is asked and how it
// is used (FR-PROF-04). Only the department is required.

const select =
  'flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

function Section({ id, title, why, children }: { id?: string; title: string; why: string; children: React.ReactNode }) {
  return (
    <fieldset id={id} className="scroll-mt-20 space-y-3 rounded-xl border border-border bg-surface p-5">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      <p className="text-xs text-muted-foreground">{why}</p>
      {children}
    </fieldset>
  );
}

function Select({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string;
  options: readonly { id: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} defaultValue={defaultValue} className={select}>
        <option value="">Not set</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  id,
  label,
  defaultValue,
  min,
  max,
  step = 1,
}: {
  id: string;
  label: string;
  defaultValue: number | undefined;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function Checkboxes({
  name,
  options,
  checked,
}: {
  name: string;
  options: readonly { id: string; label: string }[];
  checked: readonly string[];
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={o.id} defaultChecked={checked.includes(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/** A like / avoid choice for each item (colours, fabrics). One choice per item, so they can't conflict. */
function LikeAvoid({
  prefix,
  items,
  liked,
  avoided,
  swatch,
}: {
  prefix: string;
  items: readonly { id: string; label: string; hex?: string }[];
  liked: readonly string[];
  avoided: readonly string[];
  swatch?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((item) => {
        const value = liked.includes(item.id) ? 'like' : avoided.includes(item.id) ? 'avoid' : '';
        return (
          <label key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {swatch && item.hex ? (
                <span
                  aria-hidden="true"
                  className="inline-block h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: item.hex }}
                />
              ) : null}
              {item.label}
            </span>
            <select
              name={`${prefix}${item.id}`}
              defaultValue={value}
              className="h-8 rounded-md border border-input px-2 text-sm"
            >
              <option value="">—</option>
              <option value="like">Like</option>
              <option value="avoid">Avoid</option>
            </select>
          </label>
        );
      })}
    </div>
  );
}

type ProfileAction = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * `action` replaces the default save (onboarding saves and continues); `before` renders extra fields
 * at the top of the same form (onboarding asks Google sign-ups for their city there).
 */
export function ProfileForm({
  initial,
  action: submit = saveProfileAction,
  before,
  submitLabel = 'Save style profile',
}: {
  initial: ProfileResponse;
  action?: ProfileAction;
  before?: React.ReactNode | ((state: FormState) => React.ReactNode);
  submitLabel?: string;
}) {
  const [state, action, pending] = useActionState(submit, undefined);
  const { sizes, fitPreferences: fit, coveragePreferences: coverage } = initial;

  return (
    <form action={action} className="space-y-5">
      {typeof before === 'function' ? before(state) : before}
      <Section
        title="Department (required)"
        why="Which clothes StyleMe suggests. Choose “Show me everything” to see all departments."
      >
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {DEPARTMENTS.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="department"
                value={d.id}
                defaultChecked={initial.department === d.id}
                required
              />
              {d.label}
            </label>
          ))}
        </div>
      </Section>

      <Section
        id="sizes"
        title="Sizes"
        why="Each look shows your saved size for that kind of clothing, so you know what to search for. Sizes differ by category; sarees and most accessories are free size. Your body shape and appearance signals never change your size."
      >
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="size_tops_letter"
            label="Tops (T-shirts, shirts)"
            defaultValue={sizes.tops?.letter ?? ''}
            options={LETTER_SIZES.map((s) => ({ id: s, label: s }))}
          />
          <NumberField
            id="size_tops_collar"
            label="Shirt collar (inches, optional)"
            defaultValue={sizes.tops?.collarIn}
            min={13}
            max={20}
            step={0.5}
          />
          <NumberField
            id="size_bottoms_waist"
            label="Bottoms: waist (inches)"
            defaultValue={sizes.bottoms?.waistIn}
            min={24}
            max={50}
          />
          <NumberField
            id="size_bottoms_length"
            label="Bottoms: length (inches, optional)"
            defaultValue={sizes.bottoms?.lengthIn}
            min={26}
            max={36}
          />
          <Select
            id="size_ethnicTops_letter"
            label="Kurtas and kurtis (letter)"
            defaultValue={sizes.ethnicTops?.letter ?? ''}
            options={LETTER_SIZES.map((s) => ({ id: s, label: s }))}
          />
          <NumberField
            id="size_ethnicTops_numeric"
            label="Kurtas and kurtis (numeric, optional)"
            defaultValue={sizes.ethnicTops?.numeric}
            min={28}
            max={54}
          />
          <Select
            id="size_ethnicSets_letter"
            label="Lehengas (letter)"
            defaultValue={sizes.ethnicSets?.letter ?? ''}
            options={LETTER_SIZES.map((s) => ({ id: s, label: s }))}
          />
          <NumberField
            id="size_ethnicSets_waist"
            label="Lehengas (waist inches, optional)"
            defaultValue={sizes.ethnicSets?.waistIn}
            min={24}
            max={50}
          />
          <NumberField
            id="size_shoes_uk"
            label="Shoes (UK/India size)"
            defaultValue={sizes.shoes?.uk}
            min={1}
            max={14}
          />
        </div>
      </Section>

      <Section title="Fit" why="How you like clothes to sit. Looks favour this fit for each kind of clothing.">
        <div className="grid grid-cols-2 gap-3">
          <Select id="fit_tops" label="Tops" defaultValue={fit.tops ?? ''} options={FITS} />
          <Select id="fit_bottoms" label="Bottoms" defaultValue={fit.bottoms ?? ''} options={FITS} />
          <Select id="fit_ethnicTops" label="Kurtas and kurtis" defaultValue={fit.ethnicTops ?? ''} options={FITS} />
          <Select id="fit_ethnicSets" label="Lehengas" defaultValue={fit.ethnicSets ?? ''} options={FITS} />
        </div>
      </Section>

      <Section
        title="Colours"
        why="Colours you like are favoured; colours you avoid never appear in your looks. Everything else stays possible, and you can always explore any colour."
      >
        <LikeAvoid prefix="color_" items={COLORS} liked={initial.likedColors} avoided={initial.dislikedColors} swatch />
      </Section>

      <Section
        title="Contrast"
        why="How much contrast you like between the colours in a look (for example navy with white is high contrast)."
      >
        <Select
          id="contrastPreference"
          label="Contrast"
          defaultValue={initial.contrastPreference ?? ''}
          options={CONTRAST_PREFERENCES}
        />
      </Section>

      <Section title="Silhouettes" why="Shapes you like wearing. Looks favour them; nothing is ruled out.">
        <Checkboxes name="silhouettes" options={SILHOUETTES} checked={initial.silhouettePreferences} />
      </Section>

      <Section
        title="Coverage"
        why="The least coverage you're comfortable with. Looks never go below what you choose here."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            id="coverage_sleeve"
            label="Shortest sleeve"
            defaultValue={coverage.minSleeveLength ?? ''}
            options={SLEEVE_LENGTHS}
          />
          <Select
            id="coverage_neckline"
            label="Neckline at least"
            defaultValue={coverage.minNecklineCoverage ?? ''}
            options={NECKLINE_DEPTHS}
          />
          <Select
            id="coverage_length"
            label="Shortest length"
            defaultValue={coverage.minGarmentLength ?? ''}
            options={GARMENT_LENGTHS}
          />
        </div>
      </Section>

      <Section title="Comfort" why="Comfort features that matter to you. Looks favour them.">
        <Checkboxes name="comfort" options={COMFORT_OPTIONS} checked={initial.comfortPreferences} />
      </Section>

      <Section title="Fabrics" why="Fabrics you like are favoured; fabrics you avoid never appear in your looks.">
        <LikeAvoid
          prefix="fabric_"
          items={FABRICS}
          liked={initial.fabricPreferences.liked}
          avoided={initial.fabricPreferences.avoided}
        />
      </Section>

      <Section title="Styles" why="Styles you enjoy. Looks favour them; you can still ask for any style.">
        <Checkboxes name="styles" options={STYLES} checked={initial.preferredStyles} />
      </Section>

      <Section title="Occasions" why="Occasions you dress for most, so they're easy to pick when you ask for looks.">
        <Checkboxes name="occasions" options={OCCASIONS} checked={initial.preferredOccasions} />
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

      <Status state={state} />
      <Button size="full" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
