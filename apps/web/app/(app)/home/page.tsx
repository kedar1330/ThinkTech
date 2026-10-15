import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import {
  COLORS,
  DEPARTMENTS,
  cityLabel,
  departmentScope,
  profileCompleteness,
  type ProfileResponse,
} from '@styleme/contracts';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { FEATURES, featureHref } from '@/lib/features';

export const metadata: Metadata = { title: 'Home' };

/** Personalized Home: what StyleMe knows about the user's style today, and what is coming next. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; skipped?: string }>;
}) {
  const { user, accessToken } = await requireOnboarded();
  const { welcome, skipped } = await searchParams;
  const profile = await apiRequest<ProfileResponse>('/v1/profile', { token: accessToken });
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const department = DEPARTMENTS.find((d) => d.id === profile.department)?.label;
  // Without a department, features give general results across all departments (FR-ONB-05).
  const scope = departmentScope(profile);
  const completeness = profileCompleteness(profile, user);
  const liked = COLORS.filter((c) => profile.likedColors.includes(c.id));
  const upcoming = FEATURES.filter((f) => !f.href);

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
              <dt className="text-muted-foreground">Department</dt>
              <dd className="font-medium">
                {department ?? 'Not set'}
                {!scope.filterApplied && (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Showing all departments — no department filter applied
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
              <dt className="text-muted-foreground">Occasions</dt>
              <dd className="font-medium">{profile.preferredOccasions.length || 'None chosen yet'}</dd>
            </div>
          </dl>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Colours you love</p>
            {liked.length ? (
              <ul className="flex flex-wrap gap-2">
                {liked.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                  >
                    <span
                      aria-hidden
                      className="size-3 rounded-full border border-border"
                      style={{ backgroundColor: c.hex }}
                    />
                    {c.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm">
                None yet —{' '}
                <Link href="/profile#style-profile" className="font-medium text-plum underline">
                  add some
                </Link>
                .
              </p>
            )}
          </div>
        </Card>
        <Card className="flex flex-col justify-between gap-4 bg-primary text-primary-foreground">
          <div className="space-y-2">
            <h2 className="font-display text-2xl">Discover My Style</h2>
            <p className="text-sm text-primary-foreground/80">
              Refine your sizes, fit, colours and comfort, and manage optional appearance signals.
            </p>
          </div>
          <Button asChild variant="accent">
            <Link href="/profile">
              Open <ArrowRight aria-hidden />
            </Link>
          </Button>
        </Card>
      </section>

      <section className="space-y-5">
        <div className="space-y-1">
          <h2 className="font-display text-2xl text-primary">Coming soon</h2>
          <p className="text-sm text-muted-foreground">
            These features are being built. Your style profile will power them when they launch.
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((f) => (
            <li key={f.slug}>
              <Link
                href={featureHref(f)}
                className="block h-full space-y-2 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-plum/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{f.label}</h3>
                  <Badge>Coming soon</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{f.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
