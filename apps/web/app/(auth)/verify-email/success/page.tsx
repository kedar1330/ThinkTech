import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { Button } from '@/components/ui/button';
import { getCurrentUser, pathForStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Email verified' };

export default async function VerifySuccessPage() {
  const current = await getCurrentUser();
  return (
    <AuthSplitLayout title="Email verified successfully">
      <div className="space-y-6">
        <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success-soft p-4 text-success">
          <BadgeCheck aria-hidden className="size-6 shrink-0" />
          <p className="text-sm font-medium">Thank you — your StyleMe account is ready.</p>
        </div>
        {current ? (
          <>
            <p className="text-sm text-muted-foreground">
              Next, tell us about your style. It takes a few minutes, and you can change everything later.
            </p>
            <Button asChild size="full">
              <Link href={pathForStep(current.user.onboardingStep)}>Continue</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Log in to continue setting up your style profile.</p>
            <Button asChild size="full">
              <Link href="/login?verified=1">Continue to log in</Link>
            </Button>
          </>
        )}
      </div>
    </AuthSplitLayout>
  );
}
