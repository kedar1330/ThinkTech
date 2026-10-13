import type { Metadata } from 'next';
import Link from 'next/link';
import { RequestVerificationForm } from '@/components/auth/RecoveryForms';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { Alert } from '@/components/ui/alert';
import { readCookie } from '@/lib/actions';

export const metadata: Metadata = { title: 'Verify your email' };

/** Shown when login is blocked for an unverified email, or a verification session has ended. */
export default async function VerificationRequiredPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const email = await readCookie('pendingEmail');
  const { from } = await searchParams;
  return (
    <AuthSplitLayout
      title="Verify your email to continue"
      subtitle="Your account needs a verified email address before you can log in. We'll send a new code and link."
    >
      {from === 'login' && (
        <Alert tone="info">
          Your email address isn&rsquo;t verified yet, so you can&rsquo;t log in. Send yourself a new code below.
        </Alert>
      )}
      <RequestVerificationForm defaultEmail={email} />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-plum underline">
          Back to log in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
