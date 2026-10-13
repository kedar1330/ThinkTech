import Link from 'next/link';
import type { AppearanceResponse, ProfileResponse } from '@styleme/contracts';
import { AccountNav } from '@/components/auth/AccountNav';
import { apiRequest } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

// Links to every Stage 1 feature that exists so far (FR-PROF-01). Looks, saved looks and the shortlist
// are added here as their milestones land.
export default async function DashboardPage() {
  const { user, accessToken } = await requireUser();
  const [profile, appearance] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }),
  ]);
  const hasProfile = profile.department !== null;
  const hasSignals = Boolean(appearance.skinTone || appearance.undertone || appearance.bodyProportions);

  return (
    <>
      <AccountNav name={user.name} />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <ul className="space-y-3">
          <li className="rounded-md border border-neutral-200 p-4">
            <p className="font-medium">Style profile</p>
            <p className="text-sm text-neutral-600">
              {hasProfile
                ? 'Saved. Update it whenever your sizes or preferences change.'
                : 'Not set up yet. Tell StyleMe your department, sizes and preferences.'}
            </p>
            <Link href="/profile#style-profile" className="text-sm underline">
              {hasProfile ? 'Edit your style profile' : 'Set up your style profile'}
            </Link>
          </li>
          <li className="rounded-md border border-neutral-200 p-4">
            <p className="font-medium">Appearance signals (optional)</p>
            <p className="text-sm text-neutral-600">
              {hasSignals
                ? `Saved${appearance.useInRecommendations ? '' : ' — currently not used in recommendations'}.`
                : 'Not shared. You can add a skin-tone range, undertone or proportions if you like.'}
            </p>
            <Link href="/profile#appearance" className="text-sm underline">
              {hasSignals ? 'Review appearance signals' : 'Add appearance signals'}
            </Link>
          </li>
        </ul>
        <p className="text-sm text-neutral-600">Look suggestions arrive in the next milestones.</p>
      </main>
    </>
  );
}
