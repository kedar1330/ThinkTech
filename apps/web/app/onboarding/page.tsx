import { redirect } from 'next/navigation';
import { pathForStep, requireUser } from '@/lib/auth/session';

/** Resumes onboarding at the next incomplete step (FR-ONB-02). */
export default async function OnboardingIndex() {
  const { user } = await requireUser();
  redirect(pathForStep(user.onboardingStep));
}
