'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { FormState } from '@/lib/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Counts down from `seconds`, starting when it mounts. Give it a `key` that changes with each new
 * server result (`resultKey`) so a fresh cooldown restarts the timer.
 */
export function Cooldown({ seconds, children }: { seconds: number; children: (left: number) => React.ReactNode }) {
  const [deadline] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [deadline]);
  return <>{children(Math.max(0, Math.ceil((deadline - now) / 1000)))}</>;
}

/** A key that changes whenever the server returns a new result. */
export function resultKey(state: FormState, fallback = 'initial'): string {
  return state?.issuedAt ? String(state.issuedAt) : fallback;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.ceil(seconds / 60);
  return `${m} min`;
}

/** Form-level message, with the follow-up link that fits the error. */
export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <Alert tone="error">
        <p>{state.error}</p>
        {state.code === 'EMAIL_ALREADY_REGISTERED' && (
          <p>
            <Link href="/login">Log in</Link> or <Link href="/forgot-password">reset your password</Link>.
          </p>
        )}
        {state.code === 'REGISTRATION_PENDING' && (
          <p>
            <Link href="/register">Sign up again</Link> to get a new code.
          </p>
        )}
        {state.code === 'EMAIL_NOT_REGISTERED' && (
          <p>
            <Link href="/register">Sign up</Link> to create an account.
          </p>
        )}
        {state.code === 'EMAIL_NOT_VERIFIED' && (
          <p>
            <Link href="/verify-email/required">Verify your email</Link> to continue.
          </p>
        )}
        {state.code === 'ACCOUNT_LOCKED' && (
          <p>
            <Link href="/forgot-password">Reset your password</Link> to unlock your account now.
          </p>
        )}
        {(state.code === 'OTP_LOCKED' || state.code === 'RESEND_LIMIT') && state.retryAfterSeconds ? (
          <p>Try again in about {formatWait(state.retryAfterSeconds)}.</p>
        ) : null}
      </Alert>
    );
  }
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return null;
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
  disabled,
  variant,
  onClick,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  variant?: 'default' | 'destructive' | 'outline';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      type="submit"
      size="full"
      variant={variant}
      disabled={pending || disabled}
      aria-busy={pending}
      onClick={onClick}
    >
      {pending ? (
        <>
          <Spinner /> {pendingLabel ?? 'Please wait…'}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

const GOOGLE_MESSAGES: Record<string, string> = {
  unavailable: 'Google sign-in is not available yet. Please use your email instead.',
  terms: 'Accept the Terms of Service and Privacy Policy before continuing with Google.',
  exists: 'This email already has a StyleMe account. Log in instead — you can continue with Google on the login page.',
  no_account: 'There is no StyleMe account for this Google email yet. Sign up first.',
  not_invited: 'StyleMe is in a closed beta. Registration is by invitation only for now.',
  locked: 'This account is temporarily locked. Try again in 30 minutes, or reset your password.',
  forbidden: 'Google could not confirm this account. Please use your email instead.',
  cancelled: 'Google sign-in was cancelled.',
  failed: 'Google sign-in did not complete. Please try again.',
};

export function GoogleMessage({ reason, detail }: { reason?: string; detail?: string }) {
  if (!reason) return null;
  const base = GOOGLE_MESSAGES[reason] ?? GOOGLE_MESSAGES.failed;
  const message = detail ? `${base} [Reason: ${detail}]` : base;
  return <Alert tone={reason === 'cancelled' ? 'info' : 'error'}>{message}</Alert>;
}

export function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  );
}

/** "Continue with Google" — a plain navigation to the server-side OAuth start (no client secrets). */
export function GoogleButton({
  href,
  enabled,
  disabledReason,
}: {
  href: string;
  enabled: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="space-y-1.5">
      {enabled ? (
        <Button asChild variant="outline" size="full">
          <a href={href}>
            <GoogleIcon /> Continue with Google
          </a>
        </Button>
      ) : (
        <Button type="button" variant="outline" size="full" disabled aria-describedby="google-disabled">
          <GoogleIcon /> Continue with Google
        </Button>
      )}
      {!enabled && disabledReason && (
        <p id="google-disabled" className="text-center text-xs text-muted-foreground">
          {disabledReason}
        </p>
      )}
    </div>
  );
}
