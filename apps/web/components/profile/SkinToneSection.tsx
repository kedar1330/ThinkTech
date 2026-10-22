'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { MONK_TONES, undertoneIllustrationPath, type AppearanceResponse } from '@styleme/contracts';
import { confirmAppearanceAction, saveSkinToneAction } from '@/app/actions/appearance';
import type { FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { ModeChoice, SourceLine, Status, type EntryMode } from '@/components/profile/AppearanceShared';
import { PhotoUpload } from '@/components/profile/PhotoUpload';
import { cn } from '@/lib/utils';

// Skin tone and undertone (D-129). The user either uploads a face photo (analysed by Gemini, shown at once)
// or chooses both manually; picking one hides the other. A photo result can be confirmed or corrected.

export const MANUAL_UNDERTONES = [
  { id: 'cool', label: 'Cool', hint: 'pinkish' },
  { id: 'neutral', label: 'Neutral', hint: 'balanced' },
  { id: 'warm', label: 'Warm', hint: 'golden' },
  { id: 'olive', label: 'Olive', hint: 'greenish' },
] as const;
type ManualUndertone = (typeof MANUAL_UNDERTONES)[number]['id'];

function monkToneOf(appearance: AppearanceResponse): number | null {
  const range = appearance.skinTone?.value.monkRange;
  return range ? Number(range.split('-')[0]) : null;
}

function initialMode(appearance: AppearanceResponse): EntryMode | null {
  if (!appearance.skinTone && !appearance.undertone) return null;
  return appearance.skinTone?.source === 'photo_estimate' ? 'photo' : 'manual';
}

export function SkinToneSection({
  appearance,
  analysisAvailable,
}: {
  appearance: AppearanceResponse;
  analysisAvailable: boolean;
}) {
  const [mode, setMode] = useState<EntryMode | null>(initialMode(appearance));
  const [state, setState] = useState<FormState>(undefined);
  const [pending, startTransition] = useTransition();
  const tone = monkToneOf(appearance);
  const undertone = appearance.undertone?.value ?? null;
  const [pickedTone, setPickedTone] = useState<number | null>(tone);
  const [pickedUndertone, setPickedUndertone] = useState<ManualUndertone | null>(
    MANUAL_UNDERTONES.some((u) => u.id === undertone) ? (undertone as ManualUndertone) : null,
  );
  const needsReview =
    (appearance.skinTone && !appearance.skinTone.userConfirmed) ||
    (appearance.undertone && !appearance.undertone.userConfirmed);

  function saveManual() {
    if (pickedTone === null || pickedUndertone === null) {
      setState({ error: 'Choose a skin tone and an undertone.' });
      return;
    }
    startTransition(async () =>
      setState(await saveSkinToneAction({ monkTone: pickedTone, undertone: pickedUndertone })),
    );
  }

  function confirm() {
    startTransition(async () => setState(await confirmAppearanceAction(['skinTone', 'undertone'])));
  }

  function correct() {
    setPickedTone(tone);
    setPickedUndertone(MANUAL_UNDERTONES.some((u) => u.id === undertone) ? (undertone as ManualUndertone) : null);
    setMode('manual');
    setState(undefined);
  }

  return (
    <div className="space-y-5">
      {appearance.skinTone && appearance.undertone && tone !== null ? (
        <div className="space-y-3 rounded-xl border border-plum/30 bg-accent-soft/40 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-plum">Your result</p>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="size-12 rounded-full border border-border shadow-sm"
                style={{ backgroundColor: MONK_TONES[tone - 1]?.hex }}
              />
              <div>
                <p className="text-sm font-medium">Skin tone {tone}</p>
                <p className="text-xs text-muted-foreground">Monk scale, 1 (lightest) – 10 (deepest)</p>
              </div>
            </div>
            {undertone && undertone !== 'not_sure' ? (
              <div className="flex items-center gap-3">
                <Image
                  src={undertoneIllustrationPath(undertone)}
                  alt=""
                  width={48}
                  height={50}
                  unoptimized
                  className="rounded-lg bg-surface"
                />
                <div>
                  <p className="text-sm font-medium">
                    {MANUAL_UNDERTONES.find((u) => u.id === undertone)?.label ?? undertone} undertone
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          <SourceLine attribute={appearance.skinTone} />
          {needsReview ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={confirm} disabled={pending}>
                Yes, that’s right
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={correct} disabled={pending}>
                Correct it
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" variant="outline" onClick={correct}>
              Change
            </Button>
          )}
        </div>
      ) : null}

      <ModeChoice
        mode={mode}
        onChange={(m) => {
          setMode(m);
          setState(undefined);
        }}
        photoLabel="Upload my face photo"
        manualLabel="Choose manually"
        photoAvailable={analysisAvailable}
      />

      {mode === 'photo' ? <PhotoUpload kind="face" /> : null}

      {mode === 'manual' ? (
        <div className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Manual skin tone selection</legend>
            <p className="text-xs text-muted-foreground">
              Choose the swatch closest to the skin on your cheeks and jawline in daylight.
            </p>
            <div className="grid grid-cols-5 gap-3" role="radiogroup" aria-label="Skin tone">
              {MONK_TONES.map((t) => (
                <button
                  key={t.tone}
                  type="button"
                  role="radio"
                  aria-checked={pickedTone === t.tone}
                  aria-label={`Skin tone ${t.tone}`}
                  onClick={() => setPickedTone(t.tone)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors',
                    pickedTone === t.tone ? 'bg-accent-soft ring-2 ring-plum' : 'hover:bg-surface-muted',
                  )}
                >
                  <span
                    aria-hidden
                    className="aspect-square w-full max-w-14 rounded-full border border-border shadow-sm"
                    style={{ backgroundColor: t.hex }}
                  />
                  <span className="text-xs text-muted-foreground">{t.tone}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Undertone</legend>
            <p className="text-xs text-muted-foreground">
              Look at the veins on your inner wrist in daylight: blue or purple suggests cool, green suggests warm, a
              mix suggests neutral, and a muted greenish cast suggests olive.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Undertone">
              {MANUAL_UNDERTONES.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={pickedUndertone === u.id}
                  onClick={() => setPickedUndertone(u.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-xl border border-input bg-surface p-3 transition-colors hover:border-plum/50',
                    pickedUndertone === u.id && 'border-plum bg-accent-soft/50 ring-2 ring-plum/40',
                  )}
                >
                  <Image src={undertoneIllustrationPath(u.id)} alt="" width={96} height={100} unoptimized />
                  <span className="text-sm font-medium">{u.label}</span>
                  <span className="text-xs text-muted-foreground">({u.hint})</span>
                </button>
              ))}
            </div>
          </fieldset>

          <Button type="button" size="full" onClick={saveManual} disabled={pending}>
            {pending ? 'Saving…' : 'Save skin tone and undertone'}
          </Button>
        </div>
      ) : null}
      <Status state={state} />
    </div>
  );
}
