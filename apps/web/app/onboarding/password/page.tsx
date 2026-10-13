import type { Metadata } from 'next';
import { OnboardingFrame } from '@/components/app/OnboardingFrame';
import { SetupPasswordForm } from '@/components/app/OnboardingForms';
import { requireStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Create your password' };

export default async function SetupPasswordPage() {
  const { user } = await requireStep('set_password');
  return (
    <OnboardingFrame
      current="verify"
      title="Create your StyleMe password"
      intro={
        <>
          You signed up with Google as <strong className="text-foreground">{user.email}</strong>. A StyleMe password
          lets you also log in with your email, and protects changes to your account.
        </>
      }
    >
      <SetupPasswordForm />
    </OnboardingFrame>
  );
}
