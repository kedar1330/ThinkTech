'use client';

import { Camera, PencilLine } from 'lucide-react';
import type { AppearanceAttribute } from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import type { FormState } from '@/lib/actions';
import { cn } from '@/lib/utils';

// Pieces shared by the skin-tone and body-type sections of My Profile (D-129).

export type EntryMode = 'photo' | 'manual';

/** Two big options; choosing one hides the other's content (the user picks how to give the information). */
export function ModeChoice({
  mode,
  onChange,
  photoLabel,
  manualLabel,
  photoAvailable,
}: {
  mode: EntryMode | null;
  onChange: (mode: EntryMode) => void;
  photoLabel: string;
  manualLabel: string;
  photoAvailable: boolean;
}) {
  const options = [
    { id: 'photo' as const, label: photoLabel, Icon: Camera, disabled: !photoAvailable },
    { id: 'manual' as const, label: manualLabel, Icon: PencilLine, disabled: false },
  ];
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {options.map(({ id, label, Icon, disabled }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            'flex min-h-16 items-center gap-3 rounded-xl border border-input bg-surface px-4 py-3 text-left text-sm font-medium transition-colors hover:border-plum/50 disabled:cursor-not-allowed disabled:opacity-50',
            mode === id && 'border-plum bg-accent-soft/50',
          )}
        >
          <Icon aria-hidden className="size-5 shrink-0 text-plum" />
          <span>
            {label}
            {disabled ? (
              <span className="block text-xs font-normal text-muted-foreground">Not available right now</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

const SOURCE_TEXT: Record<AppearanceAttribute<unknown>['source'], string> = {
  self_reported: 'Chosen by you',
  photo_estimate: 'From your photo',
  measurements: 'From your measurements',
  user_corrected: 'Corrected by you',
};

export function SourceLine({ attribute }: { attribute: AppearanceAttribute<unknown> }) {
  const confidence = attribute.estimate?.confidence;
  return (
    <p className="text-xs text-muted-foreground">
      {SOURCE_TEXT[attribute.source]}
      {attribute.source === 'photo_estimate' && confidence ? ` · ${confidence} confidence` : ''}
      {attribute.userConfirmed ? ' · confirmed' : ' · waiting for your review'}
    </p>
  );
}

export function Status({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="error">{state.error}</Alert>;
  if (state?.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}
