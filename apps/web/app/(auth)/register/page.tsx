import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { GoogleMessage } from '@/components/auth/shared';
import { AuthSplitLayout } from '@/components/site/AuthSplitLayout';
import { googleConfigured } from '@/lib/auth/google';
import { getCurrentUser, pathForStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sign up' };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const current = await getCurrentUser();
  if (current) redirect(pathForStep(current.user.onboardingStep));
  const { google } = await searchParams;
  return (
    <AuthSplitLayout
      title="Create your account"
      subtitle={
        <>
          Already a member?{' '}
          <Link href="/login" className="font-medium text-plum underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleMessage reason={google} />
      <RegisterForm googleEnabled={googleConfigured()} />
    </AuthSplitLayout>
  );
}
