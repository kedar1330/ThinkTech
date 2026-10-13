import type { AppearanceResponse, ProfileResponse } from '@styleme/contracts';
import { AccountNav } from '@/components/auth/AccountNav';
import { ChangePasswordForm, DeleteAccountForm } from '@/components/auth/forms';
import { AppearanceForm } from '@/components/profile/AppearanceForm';
import { ProfileForm } from '@/components/profile/ProfileForm';
import { apiRequest } from '@/lib/api/server';
import { requireUser } from '@/lib/auth/session';

export default async function ProfilePage() {
  const { user, accessToken } = await requireUser();
  const [profile, appearance] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }),
  ]);
  return (
    <>
      <AccountNav name={user.name} />
      <main className="mx-auto max-w-2xl space-y-10 px-4 py-8">
        <section className="space-y-2">
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-neutral-600">{user.email}</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a href="#style-profile" className="underline">
              Style profile
            </a>
            <a href="#appearance" className="underline">
              Appearance signals
            </a>
            <a href="#password" className="underline">
              Change password
            </a>
            <a href="#delete" className="underline">
              Delete account
            </a>
          </nav>
        </section>
        <section id="style-profile" className="scroll-mt-4 space-y-4">
          <h2 className="text-lg font-medium">Style profile</h2>
          <p className="text-sm text-neutral-600">
            Only the department is required; everything else is optional and can be changed at any time.
          </p>
          <ProfileForm initial={profile} />
        </section>
        <section id="appearance" className="scroll-mt-4 space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-medium">Appearance signals</h2>
          <AppearanceForm initial={appearance} />
        </section>
        <section id="password" className="scroll-mt-4 space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-medium">Change password</h2>
          <div className="max-w-md">
            <ChangePasswordForm />
          </div>
        </section>
        <section id="delete" className="scroll-mt-4 space-y-4 border-t border-neutral-200 pt-8">
          <h2 className="text-lg font-medium">Delete account</h2>
          <div className="max-w-md">
            <DeleteAccountForm />
          </div>
        </section>
      </main>
    </>
  );
}
