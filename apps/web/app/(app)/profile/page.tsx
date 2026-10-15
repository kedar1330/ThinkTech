import type { Metadata } from 'next';
import { profileCompleteness, type AppearanceResponse, type ProfileResponse } from '@styleme/contracts';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';
import { AppearanceForm } from '@/components/profile/AppearanceForm';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Discover My Style' };

export default async function ProfilePage() {
  const { user, accessToken } = await requireOnboarded();
  const [profile, appearance] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }),
  ]);
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Discover My Style</p>
        <h1 className="font-display text-4xl text-primary">Your style profile</h1>
        <nav aria-label="Profile sections" className="flex flex-wrap gap-2">
          <a
            href="#style-profile"
            className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-plum/50"
          >
            Style profile
          </a>
          <a
            href="#appearance"
            className="rounded-full border border-border bg-surface px-3 py-1 text-sm hover:border-plum/50"
          >
            Appearance signals
          </a>
        </nav>
      </header>
      <ProfileCompletenessCard completeness={profileCompleteness(profile, user)} compact />
      <section id="style-profile" className="scroll-mt-20 space-y-4">
        <h2 className="font-display text-2xl text-primary">Style profile</h2>
        <p className="text-sm text-muted-foreground">
          Only the department is required; everything else is optional and can be changed at any time.
        </p>
        <ProfileForm initial={profile} />
      </section>
      <Card id="appearance" className="scroll-mt-20 space-y-4">
        <h2 className="font-display text-2xl text-primary">Appearance signals</h2>
        <AppearanceForm initial={appearance} />
      </Card>
    </div>
  );
}
