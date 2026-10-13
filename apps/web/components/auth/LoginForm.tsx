'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { loginAction } from '@/app/actions/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { OrDivider } from '@/components/ui/divider';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormMessage, GoogleButton, SubmitButton } from './shared';

/** Email + password login (FR-AUTH-03). Remember Me is unchecked by default (D-91). */
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const errors = state?.fieldErrors ?? {};

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4" noValidate>
        <Field id="email" label="Email" error={errors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-plum underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Checkbox
          id="rememberMe"
          name="rememberMe"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          label={<span className="text-muted-foreground">Remember me for 30 days on this device.</span>}
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending} pendingLabel="Logging in…">
          Log In
        </SubmitButton>
      </form>
      <OrDivider />
      <GoogleButton
        href={`/api/oauth/google/start?intent=login&remember=${remember ? 1 : 0}`}
        enabled={googleEnabled}
        disabledReason={googleEnabled ? undefined : 'Google login is not available yet.'}
      />
      <p className="text-center text-sm text-muted-foreground">
        New to StyleMe?{' '}
        <Link href="/register" className="font-medium text-plum underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
