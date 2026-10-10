import type { AppearanceResponse } from '@styleme/contracts';
import { AccountNav } from '@/components/auth/AccountNav';
import { ChangePasswordForm, DeleteAccountForm } from '@/components/auth/forms';
import { AppearanceForm } from '@/components/profile/AppearanceForm';
import { apiRequest } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export default async function ProfilePage() {
  const { user, accessToken } = await requireUser();
  const appearance = await apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken });
  return (
    <>
      <AccountNav name={user.name} />
      <main className="mx-auto max-w-md space-y-10 px-4 py-8">
        <section className="space-y-1">
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
        </section>
        <section className="space-y-4">
          <h2 className="text-lg font-medium">Appearance signals</h2>
          <AppearanceForm initial={appearance} />
        </section>
        <section className="space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-medium">Change password</h2>
          <ChangePasswordForm />
        </section>
        <section className="space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-medium">Delete account</h2>
          <DeleteAccountForm />
        </section>
      </main>
    </>
  );
}
