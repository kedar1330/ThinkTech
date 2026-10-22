import type { Metadata } from 'next';
import type { ProfileResponse } from '@styleme/contracts';
import { OnboardingFrame } from '@/components/app/OnboardingFrame';
import { SkipStyleProfile, StyleProfileStep } from '@/components/app/OnboardingForms';
import { apiRequest } from '@/lib/api/server';
import { requireStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Your style profile' };

export default async function StyleProfileStepPage() {
  const { user, accessToken } = await requireStep('style_profile');
  const profile = await apiRequest<ProfileResponse>('/v1/profile', { token: accessToken });
  return (
    <OnboardingFrame
      current="style_profile"
      title="Tell us about your style"
      intro="Choose your clothing preference — it is the only required answer — or skip and finish it later."
    >
      <SkipStyleProfile />
      <StyleProfileStep initial={profile} askCity={!user.city} />
    </OnboardingFrame>
  );
}
