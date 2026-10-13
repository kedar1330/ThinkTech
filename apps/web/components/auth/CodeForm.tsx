'use client';

import { useActionState, useEffect, useId, useState } from 'react';
import type { FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { OtpInput, otpComplete } from '@/components/ui/otp-input';
import { Cooldown, FormMessage, SubmitButton, formatWait, resultKey } from './shared';

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type ResendAction = (prev: FormState) => Promise<FormState>;

const noResend: ResendAction = async () => undefined;

/**
 * Six-box code entry with an explicit Verify button and a resend control with a visible cooldown
 * (D-89). Server actions are passed straight to the forms so they also work as plain form posts.
 */
export function CodeForm({
  label,
  verifyAction,
  resendAction,
  initialCooldown = 30,
  verifyLabel = 'Verify',
  children,
  formId,
  submitDisabled,
  onSubmitClick,
  variant,
  onResent,
}: {
  label: string;
  verifyAction: Action;
  resendAction?: ResendAction;
  /** Seconds before the first resend is allowed (a code was just sent). */
  initialCooldown?: number;
  verifyLabel?: string;
  /** Extra fields rendered inside the verify form (e.g. new password). */
  children?: React.ReactNode;
  /** Lets a button outside the form (e.g. in a confirmation dialog) submit it. */
  formId?: string;
  /** Extra condition that keeps the submit button disabled. */
  submitDisabled?: boolean;
  /** Runs before submitting; call `preventDefault()` to stop (e.g. to ask for confirmation first). */
  onSubmitClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: 'default' | 'destructive';
  /** Called with the time a resend succeeded (a new code was issued). */
  onResent?: (issuedAt: number) => void;
}) {
  const labelId = useId();
  const [code, setCode] = useState('');
  const [state, verify, verifying] = useActionState(verifyAction, undefined);
  const [resendState, resend, resending] = useActionState(resendAction ?? noResend, undefined);
  const locked = state?.code === 'OTP_LOCKED';
  const cooldownSeconds = resendState ? (resendState.retryAfterSeconds ?? 0) : initialCooldown;
  const resentAt = resendState?.success ? resendState.issuedAt : undefined;
  useEffect(() => {
    if (resentAt) onResent?.(resentAt);
  }, [resentAt, onResent]);

  return (
    <div className="space-y-5">
      <form id={formId} action={verify} className="space-y-5">
        <div className="space-y-2">
          <p id={labelId} className="text-sm font-medium">
            {label}
          </p>
          <OtpInput
            name="otp"
            value={code}
            onChange={setCode}
            labelledBy={labelId}
            invalid={Boolean(state?.error)}
            disabled={locked}
          />
        </div>
        {children}
        <FormMessage state={state} />
        <SubmitButton
          pending={verifying}
          pendingLabel="Verifying…"
          disabled={!otpComplete(code) || locked || submitDisabled}
          onClick={onSubmitClick}
          variant={variant}
        >
          {verifyLabel}
        </SubmitButton>
      </form>
      {resendAction && (
        <form action={resend} className="space-y-3 text-center">
          <FormMessage state={resendState} />
          <Cooldown key={resultKey(resendState)} seconds={cooldownSeconds}>
            {(left) => (
              <p className="text-sm text-muted-foreground">
                Didn&rsquo;t get it? Check your spam folder, or{' '}
                {left > 0 ? (
                  <span aria-live="polite">resend in {formatWait(left)}</span>
                ) : (
                  <Button type="submit" variant="link" disabled={resending} className="h-auto text-sm">
                    {resending ? 'Sending…' : 'resend the code'}
                  </Button>
                )}
                .
              </p>
            )}
          </Cooldown>
        </form>
      )}
    </div>
  );
}
