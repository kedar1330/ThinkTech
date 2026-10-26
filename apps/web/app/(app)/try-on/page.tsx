import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  objectIdSchema,
  slotIdSchema,
  tryOnItemSchema,
  type AppearanceResponse,
  type Design,
  type LookPicksResponse,
  type OutfitDetail,
  type OutfitListResponse,
  type ProfileResponse,
  type TryOnOverview,
} from '@styleme/contracts';
import { FittingRoom } from '@/components/try-on/FittingRoom';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { lookTitle } from '@/lib/outfits/look-text';

export const metadata: Metadata = { title: 'Virtual Try-On' };

/**
 * 3D Virtual Try-On (#106, D-137), opened from Shop My Look, Design Studio, or Discover My Style:
 * `?outfitId=` dresses the mannequin in the whole look; with `&slotId=` in one part of it;
 * with `&designId=` it resolves the design's look.
 */
export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{
    outfitId?: string;
    slotId?: string;
    store?: string;
    title?: string;
    price?: string;
    designId?: string;
  }>;
}) {
  const { accessToken: token } = await requireOnboarded();
  const params = await searchParams;
  let targetOutfitId = params.outfitId;
  let design: Design | null = null;
  if (params.designId) {
    const dId = objectIdSchema.safeParse(params.designId);
    if (dId.success) {
      design = await apiRequest<Design>(`/v1/design-studio/designs/${dId.data}`, { token }).catch(() => null);
      if (design?.lookId && !targetOutfitId) targetOutfitId = design.lookId;
    }
  }
  if (!targetOutfitId) {
    const list = await apiRequest<OutfitListResponse>('/v1/outfits?status=saved&limit=1', { token }).catch(() => null);
    if (list?.looks[0]?.id) {
      targetOutfitId = list.looks[0].id;
    } else {
      redirect('/shop');
    }
  }

  const outfitId = objectIdSchema.safeParse(targetOutfitId);
  if (!outfitId.success) notFound();
  const slot = params.slotId === undefined ? null : slotIdSchema.safeParse(params.slotId);
  if (slot && !slot.success) notFound();
  const item =
    slot && params.store !== undefined
      ? tryOnItemSchema.safeParse({ store: params.store, title: params.title, price: params.price })
      : null;
  if (item && !item.success) notFound();

  let look: OutfitDetail;
  let overview: TryOnOverview;
  let profile: ProfileResponse;
  let appearance: AppearanceResponse | null;
  let picks: LookPicksResponse | null;
  try {
    [look, overview, profile, appearance, picks] = await Promise.all([
      apiRequest<OutfitDetail>(`/v1/outfits/${outfitId.data}`, { token }),
      apiRequest<TryOnOverview>('/v1/try-on', { token }),
      apiRequest<ProfileResponse>('/v1/profile', { token }),
      // Only shapes the mannequin; without it a straight figure is shown.
      apiRequest<AppearanceResponse>('/v1/appearance', { token }).catch(() => null),
      apiRequest<LookPicksResponse>(`/v1/outfits/${outfitId.data}/picks`, { token }).catch(() => null),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
  const title = lookTitle(look);
  const department = (look.inputsUsed.department ?? profile.department) === 'men' ? 'men' : 'women';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Virtual Try-On</p>
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Clothes from{' '}
          <Link href={`/shop?outfitId=${look.id}`} className="font-medium text-plum underline">
            Shop My Look
          </Link>{' '}
          for this look. Pick items on the left to dress the mannequin.
        </p>
      </header>
      <FittingRoom
        look={look}
        department={department}
        bodyType={appearance?.bodyType?.value ?? null}
        picks={picks?.picks ?? []}
        start={{
          slotId: slot?.success ? slot.data : undefined,
          item: item?.success ? item.data : undefined,
        }}
        overview={overview}
        design={design ?? undefined}
      />
    </div>
  );
}
