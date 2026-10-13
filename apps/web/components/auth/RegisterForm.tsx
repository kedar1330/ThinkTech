'use client';

import { useActionState, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { registerAction } from '@/app/actions/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { CityCombobox } from '@/components/ui/city-combobox';
import { OrDivider } from '@/components/ui/divider';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';
import { EMPTY_DRAFT, readStoredDraft, saveRegistrationDraft, type RegistrationDraft } from '@/lib/auth/draft';
import { FormMessage, GoogleButton, SubmitButton } from './shared';

/**
 * Registration (FR-AUTH-01, D-87). Inputs are controlled, so a failed or offline submit keeps every
 * entry. Non-sensitive fields are also kept as a 24-hour local draft; passwords and consent never are.
 */
export function RegisterForm({ googleEnabled }: { googleEnabled: boolean }) {
  // The saved draft is only readable in the browser: render empty on the server, then remount the
  // form once with the restored values.
  const stored = useSyncExternalStore<RegistrationDraft | null | typeof SERVER>(
    noSubscribe,
    readStoredDraft,
    () => SERVER,
  );
  return stored === SERVER ? (
    <RegisterFields key="server" googleEnabled={googleEnabled} initial={EMPTY_DRAFT} persist={false} />
  ) : (
    <RegisterFields key="client" googleEnabled={googleEnabled} initial={stored ?? EMPTY_DRAFT} persist />
  );
}

const SERVER = Symbol('server');
const noSubscribe = () => () => {};

function RegisterFields({
  googleEnabled,
  initial,
  persist,
}: {
  googleEnabled: boolean;
  initial: RegistrationDraft;
  persist: boolean;
}) {
  const [state, action, pending] = useActionState(registerAction, undefined);
  const [draft, setDraft] = useState<RegistrationDraft>(initial);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    if (persist) saveRegistrationDraft(draft);
  }, [draft, persist]);

  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const errors = state?.fieldErrors ?? {};
  const mismatch = confirm.length > 0 && confirm !== password;
  const googleHref = `/api/oauth/google/start?intent=signup&terms=1&remember=${draft.rememberMe ? 1 : 0}&marketing=${draft.marketingOptIn ? 1 : 0}`;

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        <Field id="fullName" label="Full name" error={errors.fullName}>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            value={draft.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            aria-invalid={Boolean(errors.fullName) || undefined}
          />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={Boolean(errors.email) || undefined}
          />
        </Field>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-rules"
            aria-invalid={Boolean(errors.password) || undefined}
          />
          <PasswordChecklist id="password-rules" password={password} />
        </Field>
        <Field
          id="confirmPassword"
          label="Confirm password"
          error={errors.confirmPassword ?? (mismatch ? 'Passwords do not match' : undefined)}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch || Boolean(errors.confirmPassword) || undefined}
          />
        </Field>
        <Field id="city" label="City" error={errors.city} hint="Used for weather- and region-aware styling.">
          <CityCombobox
            id="city"
            name="city"
            required
            defaultValue={draft.city}
            onSelect={(id) => set('city', id)}
            invalid={Boolean(errors.city)}
          />
        </Field>
        <Field
          id="phone"
          label="Mobile number"
          optional
          error={errors.phone}
          hint="Indian mobile number. Not used for login."
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            placeholder="98765 43210"
            value={draft.phone}
            onChange={(e) => set('phone', e.target.value)}
            aria-invalid={Boolean(errors.phone) || undefined}
          />
        </Field>

        <div className="space-y-3 pt-1">
          <Checkbox
            id="acceptTerms"
            name="acceptTerms"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            aria-invalid={Boolean(errors.acceptTerms) || undefined}
            label={
              <>
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="font-medium text-plum underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="font-medium text-plum underline">
                  Privacy Policy
                </Link>
                .
              </>
            }
          />
          {errors.acceptTerms && <p className="text-xs font-medium text-destructive">{errors.acceptTerms}</p>}
          <Checkbox
            id="marketingOptIn"
            name="marketingOptIn"
            checked={draft.marketingOptIn}
            onChange={(e) => set('marketingOptIn', e.target.checked)}
            label={
              <span className="text-muted-foreground">Send me style tips and StyleMe news by email (optional).</span>
            }
          />
          <Checkbox
            id="rememberMe"
            name="rememberMe"
            checked={draft.rememberMe}
            onChange={(e) => set('rememberMe', e.target.checked)}
            label={<span className="text-muted-foreground">Remember me on this device for 30 days.</span>}
          />
        </div>

        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingLabel="Creating your account…">
          Create Account
        </SubmitButton>
      </form>

      <OrDivider />
      <GoogleButton
        href={googleHref}
        enabled={googleEnabled && acceptTerms}
        disabledReason={
          !googleEnabled
            ? 'Google sign-up is not available yet.'
            : !acceptTerms
              ? 'Accept the Terms of Service and Privacy Policy above to continue with Google.'
              : undefined
        }
      />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-plum underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
