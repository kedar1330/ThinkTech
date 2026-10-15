import { AppShell } from '@/components/app/AppShell';
import { requireOnboarded } from '@/lib/auth/session';

/** Signed-in area: only for users who finished onboarding (others are sent to their next step). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOnboarded();
  return (
    <AppShell userName={user.name} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
