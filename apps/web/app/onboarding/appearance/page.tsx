import type { Metadata } from 'next';
import type { AppearanceResponse, MeasurementsResponse, PhotosResponse, ProfileResponse } from '@styleme/contracts';
import { OnboardingFrame } from '@/components/app/OnboardingFrame';
import { FinishAppearanceButtons } from '@/components/app/OnboardingForms';
import { BodyTypeSection } from '@/components/profile/BodyTypeSection';
import { SkinToneSection } from '@/components/profile/SkinToneSection';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireStep } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Skin tone and body type' };

export default async function AppearanceStepPage({ searchParams }: { searchParams: Promise<{ phone?: string }> }) {
  const { accessToken } = await requireStep('appearance');
  const { phone } = await searchParams;
  const [profile, appearance, measurements, photos] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }),
    apiRequest<MeasurementsResponse>('/v1/measurements', { token: accessToken }),
    apiRequest<PhotosResponse>('/v1/photos', { token: accessToken }),
  ]);
  const department = profile.department === 'women' || profile.department === 'men' ? profile.department : null;
  return (
    <OnboardingFrame
      current="appearance"
      title="Skin tone and body type (optional)"
      intro="Upload a face photo for skin tone analysis, choose your body type or measurements — or skip this step and add them later."
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
      <Card className="space-y-4">
        <h2 className="font-display text-2xl text-primary">Skin tone &amp; undertone</h2>
        <SkinToneSection appearance={appearance} analysisAvailable={photos.analysisAvailable} />
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-2xl text-primary">Body type</h2>
        <BodyTypeSection
          department={department}
          appearance={appearance}
          measurements={measurements}
          analysisAvailable={photos.analysisAvailable}
        />
      </Card>
      <FinishAppearanceButtons />
    </OnboardingFrame>
  );
}
