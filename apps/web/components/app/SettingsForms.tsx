'use client';

import { useActionState, useId, useState } from 'react';
import type { UserResponse } from '@styleme/contracts';
import {
  changePasswordAction,
  deleteAccountAction,
  removePhoneAction,
  sendDeletionCodeAction,
  sendPasswordChangeCodeAction,
  startEmailChangeAction,
  startPhoneAction,
  updateDetailsAction,
  verifyEmailChangeAction,
  verifyPhoneAction,
} from '@/app/actions/account';
import { CodeForm } from '@/components/auth/CodeForm';
import { Cooldown, FormMessage, SubmitButton, formatWait, resultKey } from '@/components/auth/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { CityCombobox } from '@/components/ui/city-combobox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';

export function DetailsForm({ user }: { user: UserResponse }) {
  const [state, action, pending] = useActionState(updateDetailsAction, undefined);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <Field id="fullName" label="Full name" error={errors.fullName}>
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={user.name} />
      </Field>
      <Field id="city" label="City" error={errors.city}>
        <CityCombobox id="city" name="city" required defaultValue={user.city} />
      </Field>
      <Checkbox
        id="marketingOptIn"
        name="marketingOptIn"
        defaultChecked={user.marketingOptIn}
        label="Send me style tips and StyleMe news by email."
      />
      <FormMessage state={state} />
      <div className="max-w-xs">
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Save details
        </SubmitButton>
      </div>
    </form>
  );
}

/** Password change: an emailed code proves it's you (D-93). */
export function PasswordChangeForm() {
  const [sendState, send, sending] = useActionState(sendPasswordChangeCodeAction, undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const codeSent = Boolean(sendState?.data?.sent);

  if (!codeSent) {
    return (
      <form action={send} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          We&rsquo;ll email you a 6-digit code to confirm it&rsquo;s you. Your other devices will be signed out.
        </p>
        <FormMessage state={sendState} />
        <div className="max-w-xs">
          <SubmitButton pending={sending} pendingLabel="Sending…">
            Email me a code
          </SubmitButton>
        </div>
      </form>
    );
  }
  return (
    <div className="max-w-md space-y-3">
      <FormMessage state={sendState} />
      <CodeForm
        label="Code from your email"
        verifyAction={changePasswordAction}
        resendAction={sendPasswordChangeCodeAction}
        verifyLabel="Change password"
      >
        <Field id="newPassword" label="New password">
          <PasswordInput
            id="newPassword"
            name="newPassword"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="change-password-rules"
          />
          <PasswordChecklist id="change-password-rules" password={password} />
        </Field>
        <Field
          id="confirmPassword"
          label="Confirm new password"
          error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
      </CodeForm>
    </div>
  );
}

/** Email change (FR-AUTH-17): current password, then verify the new address. */
export function EmailChangeForm({ user }: { user: UserResponse }) {
  const [state, action, pending] = useActionState(startEmailChangeAction, undefined);
  // Server state decides: the page re-renders after each step.
  const awaiting = Boolean(user.pendingEmail);

  return (
    <div className="space-y-5">
      <p className="text-sm">
        Current email: <strong className="break-all">{user.email}</strong>
      </p>
      {awaiting && (
        <div className="max-w-md space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
          <p className="text-sm">
            Waiting for confirmation of <strong className="break-all">{user.pendingEmail ?? 'your new email'}</strong>.
            Your current email keeps working until then.
          </p>
          <FormMessage state={state} />
          <CodeForm
            label="Code sent to your new email"
            verifyAction={verifyEmailChangeAction}
            verifyLabel="Confirm new email"
          />
        </div>
      )}
      <details className="max-w-md" open={!awaiting}>
        <summary className="cursor-pointer text-sm font-medium text-plum">
          {awaiting ? 'Use a different new email' : 'Change email address'}
        </summary>
        <form action={action} className="mt-4 space-y-4">
          <Field id="newEmail" label="New email" error={state?.fieldErrors?.newEmail}>
            <Input id="newEmail" name="newEmail" type="email" autoComplete="email" required />
          </Field>
          <Field id="emailPassword" label="Current password" error={state?.fieldErrors?.password}>
            <PasswordInput id="emailPassword" name="password" autoComplete="current-password" required />
          </Field>
          {!awaiting && <FormMessage state={state} />}
          <SubmitButton pending={pending} pendingLabel="Sending…">
            Send confirmation
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

/** Optional phone with SMS verification (D-92). Never used for login. */
export function PhoneForm({ user }: { user: UserResponse }) {
  const [state, action, pending] = useActionState(startPhoneAction, undefined);
  const [removeState, remove, removing] = useActionState(removePhoneAction, undefined);
  const awaiting = Boolean(user.pendingPhone);

  return (
    <div className="space-y-5">
      {user.phone ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            <strong>{user.phone.number}</strong>
          </span>
          <Badge className={user.phone.verified ? 'border-success/40 bg-success-soft text-success' : ''}>
            {user.phone.verified ? 'Verified' : 'Not verified'}
          </Badge>
          <form action={remove}>
            <Button type="submit" variant="link" disabled={removing} className="h-auto text-sm">
              Remove
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No phone number. It&rsquo;s optional and never used for login.</p>
      )}
      <FormMessage state={removeState} />
      {awaiting && (
        <div className="max-w-md space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
          <p className="text-sm">
            Enter the code sent by SMS to <strong>{user.pendingPhone ?? 'your phone'}</strong>.
          </p>
          <CodeForm label="SMS code" verifyAction={verifyPhoneAction} verifyLabel="Verify phone" />
        </div>
      )}
      <form action={action} className="max-w-md space-y-4">
        <Field id="phone" label={user.phone ? 'New mobile number' : 'Mobile number'} error={state?.fieldErrors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
          />
        </Field>
        <FormMessage state={state} />
        <Cooldown key={resultKey(state)} seconds={state?.retryAfterSeconds ?? 0}>
          {(left) => (
            <SubmitButton pending={pending} pendingLabel="Sending…" disabled={left > 0}>
              {left > 0 ? `Resend in ${formatWait(left)}` : 'Send SMS code'}
            </SubmitButton>
          )}
        </Cooldown>
      </form>
    </div>
  );
}

/** Deletion (D-94): emailed code + explicit confirmation; immediate and permanent. */
export function DeleteAccountForm() {
  const [sendState, send, sending] = useActionState(sendDeletionCodeAction, undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [asking, setAsking] = useState(false);
  const formId = useId();
  const codeSent = Boolean(sendState?.data?.sent);

  if (!codeSent) {
    return (
      <form action={send} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Deleting your account removes your profile, appearance signals and sessions immediately and permanently. It
          cannot be undone. We&rsquo;ll email you a code to confirm.
        </p>
        <FormMessage state={sendState} />
        <div className="max-w-xs">
          <SubmitButton pending={sending} pendingLabel="Sending…" variant="destructive">
            Email me a deletion code
          </SubmitButton>
        </div>
      </form>
    );
  }
  return (
    <div className="max-w-md space-y-3">
      <FormMessage state={sendState} />
      <CodeForm
        label="Code from your email"
        verifyAction={deleteAccountAction}
        resendAction={sendDeletionCodeAction}
        verifyLabel="Delete my account…"
        variant="destructive"
        formId={formId}
        submitDisabled={!confirmed}
        onSubmitClick={(e) => {
          // A separate, explicit confirmation step (spec §13) before the request is sent.
          e.preventDefault();
          setAsking(true);
        }}
      >
        <Checkbox
          id="confirm"
          name="confirm"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          label="I understand my account and all its data will be deleted permanently."
        />
      </CodeForm>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        tone="danger"
        title="Delete your account permanently?"
        description="Your profile, appearance signals, saved data and sessions are deleted immediately. This cannot be undone."
      >
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={() => setAsking(false)} autoFocus>
            Cancel
          </Button>
          <Button type="submit" form={formId} variant="destructive" onClick={() => setAsking(false)}>
            Yes, delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
