import type { Metadata } from 'next';
import Link from 'next/link';
import type { ColourPreferencesResponse } from '@styleme/contracts';
import { ColourAlbum } from '@/components/colours/ColourAlbum';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Liked and avoided colours' };

/** The colours the user liked or wants to avoid (D-133); select to move or clear them. */
export default async function SavedColoursPage() {
  const { accessToken } = await requireOnboarded();
  const data = await apiRequest<ColourPreferencesResponse>('/v1/colours/preferences', { token: accessToken });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/palette" className="hover:underline">
          My Colour Palette
        </Link>{' '}
        /{' '}
        <Link href="/palette/colours" className="hover:underline">
          My colours
        </Link>{' '}
        / <span className="text-foreground">Liked and avoided</span>
      </nav>

      <header className="max-w-2xl space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">My colours</p>
        <h1 className="font-display text-4xl text-primary">Colours you like and avoid</h1>
        <p className="text-sm text-muted-foreground">
          {data.liked.length} liked · {data.avoided.length} to avoid. Select colours to move them between the lists or
          clear them.
        </p>
      </header>

      <ColourAlbum colours={[...data.liked, ...data.avoided]} mode="saved" />
    </div>
  );
}
