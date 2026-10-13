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
import { FormMessage, SubmitButton } from './shared';

/**
 * Email verification after sign-up (FR-AUTH-16): code entry, resend with cooldown, and correcting a
 * mistyped email (only for the browser that registered — it holds the pending token).
 */
export function VerifyEmailPanel({
  email,
  canEditEmail,
  initialCooldown,
  sendFailed,
}: {
  email: string | null;
  canEditEmail: boolean;
  initialCooldown: number;
  sendFailed: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // After a successful change the page re-renders with the new address and remounts this panel
  // (the page keys it by email), which also closes the edit form.
  const shownEmail = email;
  const [editState, editAction, editPending] = useActionState(changePendingEmailAction, undefined);

  // The account exists now; the sign-up draft is no longer needed.
  useEffect(() => clearRegistrationDraft(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <Mail aria-hidden className="mt-0.5 size-5 shrink-0 text-plum" />
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p>
            We sent a 6-digit code and a verification link to{' '}
            <strong className="break-all">{shownEmail ?? 'your email address'}</strong>.
          </p>
          <p className="text-muted-foreground">The code expires in 5 minutes; the link in 30 minutes.</p>
        </div>
        {canEditEmail && !editing && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Edit
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
        />
      )}
    </div>
  );
}
