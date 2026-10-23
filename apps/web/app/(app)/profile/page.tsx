import type { Metadata } from 'next';
import {
  profileCompleteness,
  type AppearanceResponse,
  type MeasurementsResponse,
  type PhotosResponse,
  type ProfileResponse,
} from '@styleme/contracts';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';
import { AppearanceSettings } from '@/components/profile/AppearanceSettings';
import { BodyTypeSection } from '@/components/profile/BodyTypeSection';
import { FieldPrivacyNote } from '@/components/profile/FieldPrivacyNote';
import { MyPhotos } from '@/components/profile/MyPhotos';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { SkinToneSection } from '@/components/profile/SkinToneSection';
import { VirtualTryOnSection } from '@/components/profile/VirtualTryOnSection';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My Profile' };

const SECTIONS = [
  { id: 'basics', label: 'Clothing preference' },
  { id: 'skin-tone', label: 'Skin tone & undertone' },
  { id: 'body-type', label: 'Body type & measurements' },
  { id: 'try-on', label: '3D Virtual Try-On' },
] as const;

// My Profile (D-129): Clothing Preference and basics, then skin tone and undertone (face photo or manual),
// then body type (measurements or full-body photo) with optional fit measurements. Everything is stored on
// the user's own records and read from there by every other feature.
export default async function ProfilePage() {
  const { user, accessToken } = await requireOnboarded();
  const [profile, appearance, measurements, photos] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }),
    apiRequest<MeasurementsResponse>('/v1/measurements', { token: accessToken }),
    apiRequest<PhotosResponse>('/v1/photos', { token: accessToken }),
  ]);
  const department = profile.department === 'women' || profile.department === 'men' ? profile.department : null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">My Profile</p>
        <h1 className="font-display text-4xl text-primary">Your profile</h1>
        <nav aria-label="Profile sections" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-plum/50"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>
      <ProfileCompletenessCard completeness={profileCompleteness(profile, user, appearance)} compact />

      <section id="basics" className="scroll-mt-20 space-y-4">
        <h2 className="font-display text-2xl text-primary">Clothing preference</h2>
        <ProfileForm initial={profile} />
      </section>

      <Card id="skin-tone" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-primary">Skin tone &amp; undertone</h2>
          <p className="text-sm text-muted-foreground">
            Upload a face photo and we’ll analyse both for you, or choose them yourself.
          </p>
        </div>
        <SkinToneSection appearance={appearance} analysisAvailable={photos?.analysisAvailable ?? true} />
      </Card>

      <Card id="body-type" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-primary">Body type</h2>
          <p className="text-sm text-muted-foreground">
            Enter a few measurements and we’ll identify your body type, or choose your body type directly.
          </p>
        </div>
        <BodyTypeSection
          key={department ?? 'women'}
          department={department ?? 'women'}
          appearance={appearance}
          measurements={measurements}
          analysisAvailable={photos?.analysisAvailable ?? true}
        />
      </Card>

      <Card id="try-on" className="scroll-mt-20 space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-primary">3D Virtual Try-On</h2>
          <p className="text-sm text-muted-foreground">
            Choose whether to upload your photo to create a personalized 3D model, or try on clothes using our standard
            dummy model.
          </p>
        </div>
        <VirtualTryOnSection profile={profile} photos={photos.photos} />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-display text-xl text-primary">Your photos and privacy</h2>
        <MyPhotos photos={photos.photos} />
        <AppearanceSettings appearance={appearance} />
        <FieldPrivacyNote
          usedFor="Suggesting colours that suit your skin tone and undertone, and cuts that suit your body type — never as restrictions, and never to decide your size."
          whoSees="Private to you. Photos you upload are sent to Google Gemini only to analyse them, after you agree; with a full-body photo we also send the height in your profile, and nothing else about you. Your other measurements are never sent to any AI service."
          howToDelete="Change or clear any result, or delete a photo, at any time. Everything is permanently removed if you delete your account."
        />
      </Card>
    </div>
  );
}
