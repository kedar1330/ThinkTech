import type { Metadata } from 'next';
import Link from 'next/link';
import { verifyEmailLinkAction } from '@/app/actions/auth';
import { LinkHandler } from '@/components/auth/LinkHandler';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Verify your email', referrer: 'no-referrer' };

export default function VerifyEmailLinkPage() {
  return (
    <AuthSplitLayout title="Verifying your email">
      <LinkHandler
        action={verifyEmailLinkAction}
        workingText="Checking your verification link…"
        failure={
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Verification links work once and expire after 30 minutes. You can get a new code and link by email.
            </p>
            <Button asChild size="full">
              <Link href="/verify-email/required">Send a new verification email</Link>
            </Button>
            <Button asChild size="full" variant="outline">
              <Link href="/verify-email">Enter the 6-digit code instead</Link>
            </Button>
          </div>
        }
      />
    </AuthSplitLayout>
  );
}
