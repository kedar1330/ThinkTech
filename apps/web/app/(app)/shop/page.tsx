import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Info } from 'lucide-react';
import {
  SHORTLIST_LIMITS,
  objectIdSchema,
  slotIdSchema,
  type OutfitDetail,
  type OutfitListResponse,
  type ProfileResponse,
  type ShortlistListResponse,
  type UserShortlistItem,
} from '@styleme/contracts';
import { SaveLookButton } from '@/components/outfits/SaveLookButton';
import { LookShopper } from '@/components/shop/LookShopper';
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
 * `/shop?outfitId=<id>` (optionally `&slotId=<id>`) opens one look: the "Shop this look" entry point from
 * the Discover results and saved looks. No real product, retailer or verified price appears here.
 */
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ outfitId?: string; slotId?: string }>;
}) {
  const { accessToken: token } = await requireOnboarded();
  const params = await searchParams;

  if (params.outfitId !== undefined) {
    const id = objectIdSchema.safeParse(params.outfitId);
    if (!id.success) notFound();
    let look: OutfitDetail;
    let items: UserShortlistItem[];
    let profile: ProfileResponse;
    try {
      [look, items, profile] = await Promise.all([
        apiRequest<OutfitDetail>(`/v1/outfits/${id.data}`, { token }),
        allItems(token),
        apiRequest<ProfileResponse>('/v1/profile', { token }),
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NOT_FOUND') notFound();
      throw err;
    }
    const slot = slotIdSchema.safeParse(params.slotId);

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/shop" className="text-sm font-medium text-plum underline-offset-4 hover:underline">
          ← All saved looks
        </Link>
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Shop My Look</p>
          <h1 className="font-display text-3xl text-primary sm:text-4xl">{lookTitle(look)}</h1>
        </header>
        <ProductDataUnavailable />
        {look.status === 'saved' ? (
          <LookShopper
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

  const { looks, total } = await apiRequest<OutfitListResponse>(`/v1/outfits?status=saved&limit=${PAGE}`, { token });
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Shop My Look</p>
        <h1 className="font-display text-4xl text-primary">Shop your saved looks</h1>
      </header>
      <ProductDataUnavailable />
      {looks.length === 0 ? (
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
      ) : (
        <section aria-labelledby="shop-looks" className="space-y-3">
          <h2 id="shop-looks" className="font-display text-2xl text-primary">
            Your saved looks <span className="text-base text-muted-foreground">({total})</span>
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {looks.map((look) => (
              <li key={look.id}>
                <Card className="flex h-full flex-col justify-between gap-3 p-4">
                  <p className="font-medium">{lookTitle(look)}</p>
                  <Link
                    href={`/shop?outfitId=${look.id}`}
                    className="text-sm font-medium text-plum underline"
                    aria-label={`Shop this look: ${lookTitle(look)}`}
                  >
                    Shop this look
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
          {total > looks.length && (
            <p className="text-sm text-muted-foreground">
              Showing your {looks.length} most recent saved looks. All of them are in{' '}
              <Link href="/saved" className="font-medium text-plum underline">
                Saved Outfits
              </Link>
              .
            </p>
          )}
        </section>
      )}
    </div>
  );
}
