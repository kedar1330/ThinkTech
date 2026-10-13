import type { Metadata } from 'next';
import type { AppearanceResponse } from '@styleme/contracts';
import { OnboardingFrame } from '@/components/app/OnboardingFrame';
import { FinishAppearanceButtons } from '@/components/app/OnboardingForms';
import { AppearanceForm } from '@/components/profile/AppearanceForm';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Appearance signals' };

export default async function AppearanceStepPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { accessToken } = await requireStep('appearance');
  const { phone } = await searchParams;
  const appearance = await apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken });
  return (
    <OnboardingFrame
      current="appearance"
      title="Appearance signals (optional)"
      intro="Share as much or as little as you like — or skip this step entirely."
    >
      {phone === 'sent' && (
        <Alert tone="info">We sent a code to your phone. You can verify it any time in Settings → Phone.</Alert>
      )}
      {phone === 'unavailable' && (
        <Alert tone="info">
          Phone verification by SMS is not available yet, so your number was not saved. Your account works fully without
          one.
        </Alert>
      )}
      <Card>
        <AppearanceForm initial={appearance} />
      </Card>
      <FinishAppearanceButtons />
    </OnboardingFrame>
  );
}
