'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

export const OTP_LENGTH = 6;

/**
 * Six one-digit boxes (D-89). Typing moves forward, Backspace moves back, arrow keys navigate, and
 * pasting a code fills every box. It never submits on its own: the user presses Verify.
 */
export function OtpInput({
  value,
  onChange,
  name,
  disabled,
  invalid,
  labelledBy,
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');

  const focus = (i: number) => refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, i))]?.focus();
  const setAt = (i: number, d: string) => {
    if (i < 0) return;
    const next = digits.slice();
    next[i] = d;
    // Keep positions: a cleared box in the middle stays empty rather than shifting the rest.
    onChange(
      next
        .map((x) => x || ' ')
        .join('')
        .trimEnd(),
    );
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-labelledby={labelledBy}>
      {name && <input type="hidden" name={name} value={value.replace(/\s/g, '')} />}
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d.trim()}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_LENGTH}
          aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'h-13 w-full max-w-12 rounded-lg border border-input bg-surface text-center font-display text-xl text-foreground shadow-xs focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60',
            invalid && 'border-destructive',
          )}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const raw = e.target.value;
            const typed = raw.replace(/\D/g, '');
            if (!raw) return setAt(i, ''); // deleted
            if (!typed) return; // a non-digit key: keep the current digit
            if (typed.length > 1) {
              // Autofill or a paste into one box: spread the digits from here.
              const before = digits
                .slice(0, i)
                .map((x) => x || ' ')
                .join('');
              const merged = (before + typed).slice(0, OTP_LENGTH);
              onChange(merged);
              return focus(merged.length);
            }
            setAt(i, typed);
            focus(i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i]?.trim()) {
              e.preventDefault();
              setAt(i - 1, '');
              focus(i - 1);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              focus(i - 1);
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              focus(i + 1);
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
            if (!pasted) return;
            e.preventDefault();
            onChange(pasted);
            focus(pasted.length);
          }}
        />
      ))}
    </div>
  );
}

/** True when all six boxes hold a digit. */
export function otpComplete(value: string): boolean {
  return /^\d{6}$/.test(value);
}
