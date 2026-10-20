import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { objectIdSchema, type OutfitDetail, type ProfileResponse } from '@styleme/contracts';
import { LookDetail } from '@/components/outfits/LookDetail';
import { RemoveLookButton } from '@/components/outfits/RemoveLookButton';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { lookTitle } from '@/lib/outfits/look-text';

export const metadata: Metadata = { title: 'Saved look' };

/**
 * One look (FR-OUT-02). Another user's look, a removed one and a malformed ID all show the 404 page.
 * Regenerate (#49) and "Shop this look" (#43) are added here by their issues.
 */
export default async function SavedLookPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireOnboarded();
  const id = objectIdSchema.safeParse((await params).id);
  if (!id.success) notFound();

  let look: OutfitDetail;
  let profile: ProfileResponse;
  try {
    [look, profile] = await Promise.all([
      apiRequest<OutfitDetail>(`/v1/outfits/${id.data}`, { token: accessToken }),
      apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/saved"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-plum underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Saved Outfits
      </Link>
      <LookDetail look={look} sizes={profile.sizes} />
      <RemoveLookButton outfitId={look.id} lookName={lookTitle(look)} from="detail" />
    </div>
  );
}
