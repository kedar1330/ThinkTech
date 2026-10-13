'use client';

import { useActionState, useEffect, useState } from 'react';
import { Mail, Pencil } from 'lucide-react';
import { changePendingEmailAction, resendVerificationAction, verifyEmailOtpAction } from '@/app/actions/auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { clearRegistrationDraft } from '@/lib/auth/draft';
import { CodeForm } from './CodeForm';
import { Cooldown, FormMessage, SubmitButton } from './shared';

/** Lifetime of a newly sent code (OTP_TTL_MS on the API). */
const CODE_TTL_SECONDS = 5 * 60;

/** "kedar@example.com" → "ke•••@example.com", shown on screen instead of the full address. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, Math.min(2, Math.max(1, local.length - 1)))}•••@${domain}`;
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Email verification after sign-up (FR-AUTH-16): code entry with an expiry countdown, resend with
 * cooldown, and correcting a mistyped email (only for the browser that registered — it holds the
 * pending token). The account is created only when the code is verified.
 */
export function VerifyEmailPanel({
  email,
  canEditEmail,
  initialCooldown,
  codeExpiresInSeconds,
  sendFailed,
}: {
  email: string | null;
  canEditEmail: boolean;
  initialCooldown: number;
  /** Seconds left on the current code, when known (the registering browser); null otherwise. */
  codeExpiresInSeconds: number | null;
  sendFailed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // After a successful change the page re-renders with the new address and remounts this panel
  // (the page keys it by email), which also closes the edit form.
  const shownEmail = email;
  const [editState, editAction, editPending] = useActionState(changePendingEmailAction, undefined);
  // A resend issues a new 5-minute code; restart the expiry countdown when that happens.
  const [codeIssuedAt, setCodeIssuedAt] = useState<number | null>(null);
  const expirySeconds = codeIssuedAt ? CODE_TTL_SECONDS : codeExpiresInSeconds;

  // The sign-up details are on the server now; the browser draft is no longer needed.
  useEffect(() => clearRegistrationDraft(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-plum" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p>
            We sent a 6-digit code to{' '}
            <strong className="break-all">{shownEmail ? maskEmail(shownEmail) : 'your email address'}</strong>.
          </p>
          {expirySeconds === null ? (
            <p className="text-muted-foreground">The code expires 5 minutes after it was sent.</p>
          ) : (
            <Cooldown key={codeIssuedAt ?? 'initial'} seconds={expirySeconds}>
              {(left) => (
                <p className="text-muted-foreground" aria-live={left === 0 ? 'polite' : 'off'}>
                  {left > 0 ? (
                    <>
                      Code expires in <span className="font-medium tabular-nums">{formatClock(left)}</span>.
                    </>
                  ) : (
                    'This code has expired. Resend to get a new one.'
                  )}
                </p>
              )}
            </Cooldown>
          )}
        </div>
        {canEditEmail && !editing && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Change email
          </Button>
        )}
      </div>

      {sendFailed && (
        <Alert tone="error">We could not send the verification email. Use &ldquo;resend the code&rdquo; below.</Alert>
      )}

      {editing ? (
        <form action={editAction} className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <Field id="newEmail" label="Correct email address" error={editState?.fieldErrors?.newEmail}>
            <Input
              id="newEmail"
              name="newEmail"
              type="email"
              autoComplete="email"
              required
              defaultValue={shownEmail ?? ''}
            />
          </Field>
          <FormMessage state={editState} />
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <SubmitButton pending={editPending} pendingLabel="Sending…">
              Send new code
            </SubmitButton>
          </div>
        </form>
      ) : (
        <CodeForm
          key={shownEmail ?? ''}
          label="Enter the 6-digit code"
          verifyAction={verifyEmailOtpAction}
          resendAction={resendVerificationAction}
          initialCooldown={initialCooldown}
          verifyLabel="Verify email"
          onResent={setCodeIssuedAt}
        />
      )}
    </div>
  );
}
