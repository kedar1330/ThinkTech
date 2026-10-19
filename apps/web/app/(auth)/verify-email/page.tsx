import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { PendingVerificationResponse } from '@styleme/contracts';
import { VerifyEmailPanel } from '@/components/auth/VerifyEmailPanel';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { apiRequest } from '@/lib/api/server';
import { clientIp, readCookie } from '@/lib/actions';

export const metadata: Metadata = { title: 'Verify your email' };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ sendFailed?: string; recovery?: string }>;
}) {
  const params = await searchParams;
  const pendingToken = await readCookie('pending');
  let pending: PendingVerificationResponse | null = null;
  if (pendingToken) {
    pending = await apiRequest<PendingVerificationResponse>('/v1/auth/email-verification/pending', {
      method: 'POST',
      body: { pendingToken },
      // The lookup is rate-limited per visitor IP (codeCheck); without it every visitor shares the BFF's.
      clientIp: await clientIp(),
    }).catch(() => null);
  }
  const recoveryEmail = await readCookie('pendingEmail');
  if (!pending && !recoveryEmail) redirect('/verify-email/required');

  return (
    <AuthSplitLayout
      title="Verify your email"
      subtitle={
        params.recovery
          ? 'If this email has an account waiting for verification, we sent it a new code.'
          : 'One last step before your style journey begins.'
      }
    >
      <VerifyEmailPanel
        key={pending?.email ?? recoveryEmail ?? 'none'}
        email={pending?.email ?? recoveryEmail ?? null}
        canEditEmail={Boolean(pending)}
        initialCooldown={pending ? pending.resendAvailableInSeconds : 30}
        codeExpiresInSeconds={pending ? pending.codeExpiresInSeconds : null}
        sendFailed={Boolean(params.sendFailed)}
      />
    </AuthSplitLayout>
  );
}
