import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/RecoveryForms';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout title="Reset your password" subtitle="Enter the email you use for StyleMe.">
      <ForgotPasswordForm />
    </AuthSplitLayout>
  );
}
