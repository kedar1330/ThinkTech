import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { OutfitListResponse } from '@styleme/contracts';
import { SavedLookList } from '@/components/outfits/SavedLookList';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Saved Outfits' };

const PAGE_SIZE = 12;

/** Saved Outfits (FR-OUT-02): the user's saved looks, newest first, a page at a time (`?page=`). */
export default async function SavedOutfitsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { accessToken } = await requireOnboarded();
  const raw = (await searchParams).page;
  const page = typeof raw === 'string' && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  const list = await apiRequest<OutfitListResponse>(`/v1/outfits?status=saved&page=${page}&limit=${PAGE_SIZE}`, {
    token: accessToken,
  });
  // Past the last page (e.g. after removing its only look): start again from the first.
  if (list.looks.length === 0 && list.total > 0) redirect('/saved');

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Saved Outfits</p>
        <h1 className="font-display text-4xl text-primary">Your saved looks</h1>
        <p className="text-sm text-muted-foreground">
          Looks you save stay here until you remove them, exactly as they were suggested.
        </p>
      </header>
      <SavedLookList {...list} />
    </div>
  );
}
