import type { Metadata } from 'next';
import Link from 'next/link';
import { confirmEmailChangeLinkAction } from '@/app/actions/account';
import { LinkHandler } from '@/components/auth/LinkHandler';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Confirm your new email', referrer: 'no-referrer' };

export default function ConfirmEmailChangePage() {
  return (
    <AuthSplitLayout title="Confirming your new email">
      <LinkHandler
        action={confirmEmailChangeLinkAction}
        workingText="Checking your confirmation link…"
        failure={
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Email-change links work once and expire after 30 minutes. Your current email address is unchanged. You can
              start the change again in Settings.
            </p>
            <Button asChild size="full">
              <Link href="/settings#email">Go to Settings</Link>
            </Button>
          </div>
        }
      />
    </AuthSplitLayout>
  );
}
