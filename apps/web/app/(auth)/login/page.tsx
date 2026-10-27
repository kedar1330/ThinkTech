import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { GoogleMessage } from '@/components/auth/shared';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { Alert } from '@/components/ui/alert';
import { googleConfigured } from '@/lib/auth/google';
import { getCurrentUser, pathForStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Log in' };

type Params = {
  google?: string;
  detail?: string;
  expired?: string;
  loggedOut?: string;
  reset?: string;
  verified?: string;
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const current = await getCurrentUser();
  if (current) redirect(pathForStep(current.user.onboardingStep));
  const params = await searchParams;
  return (
    <AuthSplitLayout title="Welcome back" subtitle="Log in to continue styling.">
      {params.reset && <Alert tone="success">Your password has been reset. Log in with your new password.</Alert>}
      {params.verified && <Alert tone="success">Your email is verified. Log in to continue.</Alert>}
      {params.loggedOut && <Alert tone="info">You have been logged out on this device.</Alert>}
      {params.expired && <Alert tone="info">Your session has ended. Please log in again.</Alert>}
      <GoogleMessage reason={params.google} detail={params.detail} />
      <LoginForm googleEnabled={googleConfigured()} />
    </AuthSplitLayout>
  );
}
