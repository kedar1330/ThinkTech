import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/RecoveryForms';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { readCookie } from '@/lib/actions';

export const metadata: Metadata = { title: 'Choose a new password', referrer: 'no-referrer' };

async function hasResetToken(): Promise<boolean> {
  try {
    return Boolean((JSON.parse((await readCookie('reset')) ?? '{}') as { resetToken?: string }).resetToken);
  } catch {
    return false;
  }
}

export default async function ResetPasswordPage() {
  const hasCookieToken = await hasResetToken();
  return (
    <AuthSplitLayout title="Choose a new password">
      <ResetPasswordForm hasCookieToken={hasCookieToken} />
    </AuthSplitLayout>
  );
}
