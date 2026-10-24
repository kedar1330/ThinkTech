import { profileCompleteness, type AppearanceResponse, type ProfileResponse } from '@styleme/contracts';
import { AppShell } from '@/components/app/AppShell';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

/** Signed-in area: only for users who finished (or skipped) onboarding; others go to their next step. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = await requireOnboarded();
  // Only a hint in the navigation: if the profile can't be loaded, show no hint rather than fail the page.
  const [profile, appearance] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }).catch(() => null),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }).catch(() => null),
  ]);
  const profileIncomplete = profile && appearance ? !profileCompleteness(profile, user, appearance).complete : false;
  return (
    <AppShell userName={user.name} userEmail={user.email} userRole={user.role} profileIncomplete={profileIncomplete}>
      {children}
    </AppShell>
  );
}
