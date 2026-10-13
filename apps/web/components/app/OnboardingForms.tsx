'use client';

import { useActionState, useState } from 'react';
import type { ProfileResponse } from '@styleme/contracts';
import { completeAppearanceAction, completeStyleProfileAction, setupPasswordAction } from '@/app/actions/onboarding';
import { FormMessage, SubmitButton } from '@/components/auth/shared';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Card } from '@/components/ui/card';
import { CityCombobox } from '@/components/ui/city-combobox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordChecklist } from '@/components/ui/password-checklist';
import { PasswordInput } from '@/components/ui/password-input';

/** Google sign-ups create a StyleMe password before anything else (D-88). */
export function SetupPasswordForm() {
  const [state, action, pending] = useActionState(setupPasswordAction, undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const errors = state?.fieldErrors ?? {};
  return (
    <Card>
      <form action={action} className="max-w-md space-y-4" noValidate>
        <Field id="password" label="Password" error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="setup-password-rules"
          />
          <PasswordChecklist id="setup-password-rules" password={password} />
        </Field>
        <Field
          id="confirmPassword"
          label="Confirm password"
          error={errors.confirmPassword ?? (confirm && confirm !== password ? 'Passwords do not match' : undefined)}
        >
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Create password and continue
        </SubmitButton>
      </form>
    </Card>
  );
}

/** Style profile step. Google sign-ups also give their city (required) and phone (optional) here. */
export function StyleProfileStep({ initial, askCity }: { initial: ProfileResponse; askCity: boolean }) {
  return (
    <ProfileForm
      initial={initial}
      action={completeStyleProfileAction}
      submitLabel="Save and continue"
      before={(state) =>
        askCity ? (
          <fieldset className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <legend className="px-1 text-sm font-semibold">About you</legend>
            <Field
              id="city"
              label="City"
              error={state?.fieldErrors?.city}
              hint="Used for weather- and region-aware styling."
            >
              <CityCombobox id="city" name="city" required invalid={Boolean(state?.fieldErrors?.city)} />
            </Field>
            <Field
              id="phone"
              label="Mobile number"
              optional
              error={state?.fieldErrors?.phone}
              hint="We'll text you a code to verify it. Never used for login."
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="98765 43210"
              />
            </Field>
          </fieldset>
        ) : null
      }
    />
  );
}

export function FinishAppearanceButtons() {
  const [state, action, pending] = useActionState(completeAppearanceAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <SubmitButton pending={pending} pendingLabel="Finishing…">
        Continue to my home
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        Appearance signals are optional — continue without saving any to skip this step. You can add them later.
      </p>
    </form>
  );
}
