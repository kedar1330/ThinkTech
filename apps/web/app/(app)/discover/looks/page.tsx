import type { Metadata } from 'next';
import type { ProfileResponse } from '@styleme/contracts';
import { ProfileSummary } from '@/components/discover/ProfileSummary';
import { RequestForm } from '@/components/discover/RequestForm';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Discover My Style' };

export default async function DiscoverLooksPage() {
  const { accessToken } = await requireOnboarded();
  const profile = await apiRequest<ProfileResponse>('/v1/profile', { token: accessToken });
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Discover My Style</p>
        <h1 className="font-display text-4xl text-primary">Find looks for an occasion</h1>
        <p className="text-sm text-muted-foreground">
          Choose an occasion and, if you like, a style, wear type and colour approach. Your profile is applied
          automatically.
        </p>
      </header>
      <ProfileSummary profile={profile} />
      <RequestForm />
    </div>
  );
}
