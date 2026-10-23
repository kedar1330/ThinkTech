import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import {
  SHORTLIST_LIMITS,
  objectIdSchema,
  type AppearanceResponse,
  type LookPicksResponse,
  slotIdSchema,
  type Look,
  type OutfitDetail,
  type OutfitListResponse,
  type ProfileResponse,
  type ShortlistListResponse,
  type UserShortlistItem,
} from '@styleme/contracts';
import { OutfitImage } from '@/components/outfits/OutfitImage';
import { SaveLookButton } from '@/components/outfits/SaveLookButton';
import { BodyTypeFigure } from '@/components/shop/BodyTypeFigure';
import { LookShopper } from '@/components/shop/LookShopper';
import { LookTabs } from '@/components/shop/LookTabs';
import { ProductMatches } from '@/components/shop/ProductMatches';
import { Card } from '@/components/ui/card';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { lookTitle } from '@/lib/outfits/look-text';

export const metadata: Metadata = { title: 'Shop My Look' };

const PAGE = 50;

/** All of the user's shortlist items (at most `SHORTLIST_LIMITS.itemsPerUser`), in pages of 50. */
async function allItems(token: string): Promise<UserShortlistItem[]> {
  const items: UserShortlistItem[] = [];
  for (let page = 1; page <= Math.ceil(SHORTLIST_LIMITS.itemsPerUser / PAGE); page++) {
    const res = await apiRequest<ShortlistListResponse>(`/v1/shortlist?page=${page}&limit=${PAGE}`, { token });
    items.push(...res.items);
    if (items.length >= res.total) break;
  }
  return items;
}

/** Every saved look from Discover My Style (#115), newest first: all of them, in pages of 50. */
async function discoverLooks(token: string): Promise<Look[]> {
  const looks: Look[] = [];
  for (let page = 1; ; page++) {
    const res = await apiRequest<OutfitListResponse>(
      `/v1/outfits?status=saved&source=discover_my_style&page=${page}&limit=${PAGE}`,
      { token },
    );
    looks.push(...res.looks);
    if (res.looks.length < PAGE || looks.length >= res.total) return looks;
  }
}

/** The figure is a woman's or a man's; any other Clothing Preference shows the default figure. */
const figureDepartment = (d: string | null | undefined) => (d === 'women' || d === 'men' ? d : null);

/** Workflow PDF p17: StyleMe has no retailer products yet, so the page works over the user's own shortlist. */
function ProductDataUnavailable() {
  return (
    <Card className="flex gap-3 p-4 sm:p-5">
      <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="space-y-1 text-sm">
        <p className="font-medium">Product data unavailable</p>
        <p className="text-muted-foreground">
          StyleMe doesn&rsquo;t list products from shops yet. Add items you found anywhere to{' '}
          <Link href="/shortlist" className="font-medium text-plum underline">
            your shortlist
          </Link>
          , with the price you saw, then put them on the parts of a saved look to see the total against your budget.
        </p>
      </div>
    </Card>
  );
}

/**
 * Shop My Look, Stage 1 (#43, D-77 = B): the user's own shortlist items on the parts of their saved looks.
 * Each saved look from Discover My Style is a small tab with a Virtual Try-On button (#115); the selected
 * tab is `/shop?outfitId=<id>` (optionally `&slotId=<id>`), the "Shop this look" entry point from the
 * Discover results and saved looks. Without one, the newest look is open. No real product, retailer or
 * verified price appears here.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ outfitId?: string; slotId?: string }>;
}) {
  const { accessToken: token } = await requireOnboarded();
  const params = await searchParams;
  let selectedId: string | undefined;
  if (params.outfitId !== undefined) {
    const id = objectIdSchema.safeParse(params.outfitId);
    if (!id.success) notFound();
    selectedId = id.data;
  }

  const looks = await discoverLooks(token);
  selectedId ??= looks[0]?.id;

  if (selectedId === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Shop My Look</p>
          <h1 className="font-display text-4xl text-primary">Shop your saved looks</h1>
        </header>
        <ProductDataUnavailable />
        <Card className="space-y-2 p-4 sm:p-6">
          <h2 className="font-display text-2xl text-primary">No saved looks yet</h2>
          <p className="text-sm text-muted-foreground">
            Save a look from{' '}
            <Link href="/discover/looks" className="font-medium text-plum underline">
              Discover My Style
            </Link>{' '}
            to add items to it here.
          </p>
        </Card>
      </div>
    );
  }

  let look: OutfitDetail;
  let items: UserShortlistItem[];
  let profile: ProfileResponse;
  let appearance: AppearanceResponse | null;
  let picks: LookPicksResponse | null;
  try {
    [look, items, profile, appearance, picks] = await Promise.all([
      apiRequest<OutfitDetail>(`/v1/outfits/${selectedId}`, { token }),
      allItems(token),
      apiRequest<ProfileResponse>('/v1/profile', { token }),
      // Only picks the figure's shape (#120); without it the default figure is shown.
      apiRequest<AppearanceResponse>('/v1/appearance', { token }).catch(() => null),
      // Saved product picks (#120); without them the comparison simply starts empty.
      apiRequest<LookPicksResponse>(`/v1/outfits/${selectedId}/picks`, { token }).catch(() => null),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') notFound();
    throw err;
  }
  const slot = slotIdSchema.safeParse(params.slotId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Shop My Look</p>
        <h1 className="font-display text-3xl text-primary sm:text-4xl">{lookTitle(look)}</h1>
      </header>
      {looks.length > 0 && (
        <LookTabs
          looks={looks}
          selectedId={look.id}
          department={figureDepartment(profile.department)}
          bodyType={appearance?.bodyType?.value ?? null}
        />
      )}
      <section aria-labelledby="your-outfit" className="space-y-3">
        <h2 id="your-outfit" className="font-display text-2xl text-primary">
          Your outfit
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {look.image && <OutfitImage outfitId={look.id} ready={look.image === 'ready'} />}
          <BodyTypeFigure
            look={look}
            department={figureDepartment(look.inputsUsed.department ?? profile.department)}
            bodyType={appearance?.bodyType?.value ?? null}
          />
        </div>
      </section>
      <ProductMatches
        key={look.id}
        look={look}
        budget={profile.budgetPreference ?? null}
        fallback={<ProductDataUnavailable />}
        initialPicks={picks?.picks ?? []}
      />
      {look.status === 'saved' ? (
        <LookShopper
          key={look.id}
          look={look}
          items={items}
          sizes={profile.sizes}
          focusSlotId={slot.success ? slot.data : undefined}
        />
      ) : (
        <Card className="space-y-3 p-4 sm:p-6">
          <p className="text-sm">
            Save this look first. Items from your shortlist can be added to saved looks only, and suggested looks are
            removed after 7 days.
          </p>
          <SaveLookButton outfitId={look.id} />
        </Card>
      )}
    </div>
  );
}
