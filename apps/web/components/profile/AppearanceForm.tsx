'use client';

import { useActionState } from 'react';
import { MONK_TONES, PROPORTION_DESCRIPTORS, UNDERTONES, type AppearanceResponse } from '@styleme/contracts';
import { clearAppearanceAction, saveAppearanceAction } from '@/app/actions/appearance';
import type { FormState } from '@/lib/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const select =
  'flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

/**
 * Optional self-reported appearance signals (FR-SIG-01 … 07). Each field says why it is asked and
 * how it is used (FR-PROF-04). The values are the user's own choices; no photo is involved.
 */
export function AppearanceForm({ initial }: { initial: AppearanceResponse }) {
  const [saveState, saveAction, saving] = useActionState(saveAppearanceAction, undefined);
  const [clearState, clearAction, clearing] = useActionState(clearAppearanceAction, undefined);

  const [from, to] = initial.skinTone?.value.monkRange.split('-') ?? ['', ''];
  const hasAny = Boolean(initial.skinTone || initial.undertone || initial.bodyProportions);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All optional. If you share them, StyleMe uses them as gentle suggestions for colour palettes and cuts — never as
        restrictions, and never to decide your size. They are used only while &ldquo;Use in recommendations&rdquo; is
        on, are never sent to any AI service, and you can change or delete them at any time.
      </p>

      <form action={saveAction} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Skin-tone range (Monk scale)</legend>
          <Hint>
            A soft signal for palette suggestions. Pick one tone, or a range of up to three neighbouring tones.
          </Hint>
          <div className="flex gap-1" aria-hidden="true">
            {MONK_TONES.map((t) => (
              <div key={t.tone} className="flex flex-1 flex-col items-center gap-1">
                <span className="h-6 w-full rounded border border-border" style={{ backgroundColor: t.hex }} />
                <span className="text-[10px] text-muted-foreground">{t.tone}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="monkFrom">From tone</Label>
              <select id="monkFrom" name="monkFrom" defaultValue={from} className={select}>
                <option value="">Not set</option>
                {MONK_TONES.map((t) => (
                  <option key={t.tone} value={t.tone}>
                    Tone {t.tone}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="monkTo">To tone</Label>
              <select id="monkTo" name="monkTo" defaultValue={to} className={select}>
                <option value="">Not set</option>
                {MONK_TONES.map((t) => (
                  <option key={t.tone} value={t.tone}>
                    Tone {t.tone}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Undertone</legend>
          <Hint>Helps choose palettes. &ldquo;Not sure&rdquo; is a fine answer.</Hint>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="undertone" value="" defaultChecked={!initial.undertone} />
              Not set
            </label>
            {UNDERTONES.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="undertone" value={u.id} defaultChecked={initial.undertone?.value === u.id} />
                {u.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="bodyProportions">Proportions, in your own words</Label>
          <Hint>Used only as a soft preference for silhouettes. It never changes the size StyleMe suggests.</Hint>
          <select
            id="bodyProportions"
            name="bodyProportions"
            defaultValue={initial.bodyProportions?.value ?? ''}
            className={select}
          >
            <option value="">Not set</option>
            {PROPORTION_DESCRIPTORS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="useInRecommendations" defaultChecked={initial.useInRecommendations} />
          Use in recommendations
        </label>

        <Status state={saveState} />
        <Button size="full" disabled={saving}>
          Save appearance signals
        </Button>
      </form>

      {hasAny ? (
        <form action={clearAction} className="space-y-2">
          <Status state={clearState} />
          <Button variant="outline" size="full" disabled={clearing}>
            Delete all appearance signals
          </Button>
        </form>
      ) : null}
    </div>
  );
}
