'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  changePasswordAction,
  deleteAccountAction,
  loginAction,
  registerAction,
  resetConfirmAction,
  resetRequestAction,
  type FormState,
} from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<'input'>) {
  const id = `field-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} {...props} />
    </div>
  );
}

function Status({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <p role="alert" className="text-sm text-red-700">
        {state.error}
      </p>
    );
  if (state?.success)
    return (
      <p role="status" className="text-sm text-green-700">
        {state.success}
      </p>
    );
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <Status state={state} />
      <Button size="full" disabled={pending}>
        Log in
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="name" autoComplete="name" required maxLength={100} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password (at least 8 characters)"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Status state={state} />
      <Button size="full" disabled={pending}>
        Create account
      </Button>
    </form>
  );
}

/**
 * Reset with a code: an emailed link puts the token in the URL fragment (#token=…), which browsers
 * never send to servers or in Referer headers. It is read here, removed from the address bar at once,
 * and sent only in the POST body. An admin-issued code is typed in instead (SECURITY.md §1.1).
 */
export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetConfirmAction, undefined);
  const [token, setToken] = useState('');
  const [fromLink, setFromLink] = useState(false);

  useEffect(() => {
    const match = /(?:^#|&)token=([^&]+)/.exec(window.location.hash);
    if (match?.[1]) {
      // The URL fragment only exists in the browser, so it can't be read during server rendering;
      // it is read once on mount and then removed from the address bar.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(decodeURIComponent(match[1]));
      setFromLink(true);
    }
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  return (
    <form action={action} className="space-y-4">
      {fromLink ? (
        <>
          <input type="hidden" name="token" value={token} />
          <p className="text-sm text-muted-foreground">Your reset link was recognised. Choose a new password.</p>
        </>
      ) : (
        <Field
          label="Reset code"
          name="token"
          autoComplete="one-time-code"
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      )}
      <Field
        label="New password (at least 8 characters)"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Field
        label="Repeat new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Status state={state} />
      <Button size="full" disabled={pending}>
        Set new password
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(resetRequestAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Status state={state} />
      <Button size="full" disabled={pending}>
        Email me a reset link
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
      <Field
        label="New password (at least 8 characters)"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Field
        label="Repeat new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <Status state={state} />
      <Button size="full" disabled={pending}>
        Change password
      </Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This permanently deletes your account and everything in it. Copies in backups expire within the backup retention
        period.
      </p>
      <Field
        label="Enter your password to confirm"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Status state={state} />
      <Button variant="destructive" size="full" disabled={pending}>
        Delete my account
      </Button>
    </form>
  );
}
