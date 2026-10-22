import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  CLOTHING_PREFERENCES,
  DEFAULT_MANUAL_STEPS,
  MONK_TONES,
  bodyTypeLabel,
  cityLabel,
  departmentScope,
  profileCompleteness,
  type AppearanceResponse,
  type ManualStepsResponse,
  type ProfileResponse,
} from '@styleme/contracts';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';
import { HowItWorksManual } from '@/components/home/HowItWorksManual';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Home' };

/** Personalized Home: what StyleMe knows about the user's style today, and what is coming next. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; skipped?: string }>;
}) {
  const { user, accessToken } = await requireOnboarded();
  const { welcome, skipped } = await searchParams;
  const [profile, appearance, manualData] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }).catch(() => null),
    apiRequest<ManualStepsResponse>('/v1/manual', { token: accessToken }).catch(() => null),
  ]);
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const department = CLOTHING_PREFERENCES.find((d) => d.id === profile.department)?.label;
  // Without a department, features give general results across all departments (FR-ONB-05).
  const scope = departmentScope(profile);
  const completeness = profileCompleteness(profile, user, appearance);
  const monkTone = appearance?.skinTone ? Number(appearance.skinTone.value.monkRange.split('-')[0]) : null;
  const undertone = appearance?.undertone?.value;
  const manualSteps = manualData?.steps?.length ? manualData.steps : DEFAULT_MANUAL_STEPS;

  return (
    <div className="space-y-10">
      {welcome && <Alert tone="success">Welcome to StyleMe, {firstName}! Your style profile is set up.</Alert>}
      {skipped && (
        <Alert tone="info">
          Welcome to StyleMe, {firstName}! You skipped the style profile for now. Everything still works — add your
          details whenever you like for more personal suggestions.
        </Alert>
      )}
      <section className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Personalized home</p>
        <h1 className="font-display text-4xl text-primary">Hello, {firstName}</h1>
        <p className="text-muted-foreground">Here is your style at a glance.</p>
      </section>

      <ProfileCompletenessCard completeness={completeness} />

      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="min-w-0 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl text-primary">Your style profile</h2>
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">Edit</Link>
            </Button>
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Clothing preference</dt>
              <dd className="font-medium">
                {department ?? 'Not set'}
                {!scope.filterApplied && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Not chosen yet — showing everything
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">City</dt>
              <dd className="font-medium">{cityLabel(user.city) ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Budget per look</dt>
              <dd className="font-medium">
                {profile.budgetPreference ? `₹${profile.budgetPreference.toLocaleString('en-IN')}` : 'Not set'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Skin tone &amp; undertone</dt>
              <dd className="flex items-center gap-2 font-medium">
                {monkTone ? (
                  <>
                    <span
                      aria-hidden
                      className="size-4 rounded-full border border-border"
                      style={{ backgroundColor: MONK_TONES[monkTone - 1]?.hex }}
                    />
                    Tone {monkTone}
                    {undertone && undertone !== 'not_sure' ? `, ${undertone}` : ''}
                  </>
                ) : (
                  <Link href="/profile#skin-tone" className="text-plum underline">
                    Add from a photo or choose
                  </Link>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Body type</dt>
              <dd className="font-medium">
                {appearance?.bodyType ? (
                  bodyTypeLabel(appearance.bodyType.value)
                ) : (
                  <Link href="/profile#body-type" className="text-plum underline">
                    Add measurements or a photo
                  </Link>
                )}
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="flex flex-col justify-between gap-4 bg-primary text-primary-foreground">
          <div className="space-y-2">
            <h2 className="font-display text-2xl">Discover My Style</h2>
            <p className="text-sm text-primary-foreground/80">
              Get looks for an occasion, matched to your skin tone, undertone and body type.
            </p>
          </div>
          <Button asChild variant="accent">
            <Link href="/discover/looks">
              Open <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Card>
      </section>

      <HowItWorksManual steps={manualSteps} />
    </div>
  );
}
