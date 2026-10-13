'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { forgotPasswordAction, requestVerificationAction, resetPasswordAction } from '@/app/actions/auth';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';
import { cn } from '@/lib/utils';
import { useFragmentToken } from './LinkHandler';
import { Cooldown, FormMessage, SubmitButton, formatWait, resultKey } from './shared';

/** Verification recovery by email alone (FR-AUTH-16): always the same response, for any email. */
export function RequestVerificationForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(requestVerificationAction, undefined);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field id="email" label="Email" error={state?.fieldErrors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={defaultEmail} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send verification code
      </SubmitButton>
    </form>
  );
}

/** Forgot password: by link (15 min) or by code (5 min) — D-89. */
export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  const [method, setMethod] = useState<'link' | 'otp'>('link');
  const [email, setEmail] = useState('');
  const sent = Boolean(state?.success);

  return (
    <form action={action} className="space-y-5" noValidate>
      <Field id="email" label="Email" error={state?.fieldErrors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How would you like to reset it?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { id: 'link', title: 'Email me a link', note: 'Valid for 15 minutes' },
              { id: 'otp', title: 'Email me a code', note: 'Valid for 5 minutes' },
            ] as const
          ).map((m) => (
            <label
              key={m.id}
              className={cn(
                'cursor-pointer rounded-xl border p-3.5 text-sm transition-colors',
                method === m.id ? 'border-plum bg-accent-soft/40 ring-1 ring-plum' : 'border-border bg-surface',
              )}
            >
              <input
                type="radio"
                name="method"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="sr-only"
              />
              <span className="block font-medium">{m.title}</span>
              <span className="block text-xs text-muted-foreground">{m.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <Cooldown key={resultKey(state)} seconds={state?.retryAfterSeconds ?? 0}>
        {(left) => (
          <SubmitButton pending={pending} pendingLabel="Sending…" disabled={left > 0}>
            {left > 0 ? `Resend in ${formatWait(left)}` : sent ? 'Resend' : 'Send'}
          </SubmitButton>
        )}
      </Cooldown>
      <p className="text-center text-sm text-muted-foreground">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-plum underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

/**
 * New password. From an emailed link the token is in the URL fragment; after the code step it is in
 * an HttpOnly cookie, so the page passes `hasCookieToken`.
 */
export function ResetPasswordForm({ hasCookieToken }: { hasCookieToken: boolean }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  const fragment = useFragmentToken();
  const ready = fragment !== null;
  const token = fragment ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const errors = state?.fieldErrors ?? {};
  const mismatch = confirm.length > 0 && confirm !== password;
  const missing = ready && !token && !hasCookieToken;

  if (missing || state?.code === 'LINK_INVALID') {
    return (
      <div className="space-y-4">
        <FormMessage
          state={{
            error: state?.error ?? 'This reset link is invalid, has expired or was already used.',
          }}
        />
        <Link href="/forgot-password" className="block text-center text-sm font-medium text-plum underline">
          Request a new link or code
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <Field id="newPassword" label="New password" error={errors.newPassword}>
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="new-password-rules"
        />
        <PasswordChecklist id="new-password-rules" password={password} />
      </Field>
      <Field
        id="confirmPassword"
        label="Confirm new password"
        error={errors.confirmPassword ?? (mismatch ? 'Passwords do not match' : undefined)}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Saving…" disabled={!ready}>
        Reset password
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        After the reset you will be signed out on all devices and asked to log in with your new password.
      </p>
    </form>
  );
}
