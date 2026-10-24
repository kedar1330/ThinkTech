'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Check, RotateCcw, Shirt, Sparkles, UserRound, X } from 'lucide-react';
import {
  CATEGORIES,
  PRICE_RANGE_STORES,
  lookProductMatchesSchema,
  type BodyType,
  type Look,
  type LookPick,
  type LookProductMatches,
  type ProductListing,
  type TryOnItem,
  type TryOnOverview,
} from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { garmentSlots, vocabLabel } from '@/lib/outfits/look-text';
import { formatInr } from '@/lib/shop/format';
import { itemColour } from '@/lib/try-on/colour';
import type { Department } from '@/lib/try-on/figure';
import {
  hexOrNull,
  isWearable,
  layered,
  proportionsFor,
  sameListing,
  shapeFor,
  takeOff,
  wear,
  type WornItem,
} from '@/lib/try-on/garments';
import { cn } from '@/lib/utils';
import { ModelViews } from './ModelViews';
import { Mannequin3D } from './Mannequin3D';
import { TryOnStudio } from './TryOnStudio';

type Slot = Look['slots'][number];
type State = { kind: 'loading' } | { kind: 'ready'; matches: LookProductMatches } | { kind: 'unavailable' };

const storeName = (id: string) => PRICE_RANGE_STORES.find((s) => s.id === id)?.label ?? id;
const slotName = (slot: Slot) => vocabLabel(CATEGORIES, slot.lookSpec.category);

/** A worn item for a listing, in the look's colour for that part until the picture's own colour is read. */
function worn(slot: Slot, listing: ProductListing): WornItem {
  return {
    slotId: slot.slotId,
    slot: slot.slot,
    listing,
    shape: shapeFor(slot),
    colour: hexOrNull(slot.swatches[0]?.hex) ?? '#9a9a9a',
  };
}

/** A part's items as Shop My Look lists them: matches for the look first, then other styles (#133). */
function allListings(matches: LookProductMatches, slotId: string): ProductListing[] {
  const slot = matches.slots.find((s) => s.slotId === slotId);
  return [...(slot?.listings ?? []), ...(slot?.alternatives ?? [])];
}

/** The first outfit: the item clicked in Shop My Look, or each part's saved item, else its first with a picture. */
function initialOutfit(
  matches: LookProductMatches,
  slots: readonly Slot[],
  picks: readonly LookPick[],
  start: { slotId?: string; item?: TryOnItem },
): WornItem[] {
  const listingsOf = (slotId: string) => allListings(matches, slotId).filter((l) => l.imageUrl);
  const choose = (slot: Slot) => {
    const listings = listingsOf(slot.slotId);
    const pick = picks.find((p) => p.slotId === slot.slotId);
    return (
      (start.item && start.slotId === slot.slotId && listings.find((l) => sameListing(l, start.item!))) ||
      (pick && listings.find((l) => sameListing(l, pick))) ||
      listings[0]
    );
  };
  const parts = start.slotId ? slots.filter((s) => s.slotId === start.slotId) : slots;
  let next: WornItem[] = [];
  for (const slot of parts) {
    const listing = choose(slot);
    if (listing) next = wear(next, worn(slot, listing));
  }
  return next;
}

/**
 * The fitting room (D-137): the clothes from Shop My Look for the look the user opened, a 3D mannequin wearing
 * them, and the outfit with its prices. Opened from an item, that item is put on first; opened from a look,
 * each part's saved item (or its first item with a picture) is. Clicking an item puts it on, replacing the
 * item for the same part; clicking a worn item takes it off. Optionally, the outfit is tried on the user's
 * photo with AI ("Make it realistic").
 */
export function FittingRoom({
  look,
  department,
  bodyType,
  picks,
  start,
  overview,
}: {
  look: Pick<Look, 'id' | 'slots'>;
  department: Department;
  bodyType: BodyType | null;
  picks: readonly LookPick[];
  /** What was clicked in Shop My Look: one item, one part of the look, or (neither) the whole look. */
  start: { slotId?: string; item?: TryOnItem };
  overview: TryOnOverview;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [outfit, setOutfit] = useState<WornItem[]>([]);
  const [tab, setTab] = useState<string | null>(start.slotId ?? null);
  const [colours, setColours] = useState<Record<string, string>>({});
  const [realistic, setRealistic] = useState(false);
  const [view, setView] = useState<'model' | '3d'>('model');

  const slots = useMemo(() => garmentSlots(look).filter((s) => isWearable(s.slot)), [look]);
  const proportions = useMemo(() => proportionsFor(bodyType), [bodyType]);

  // The clothes for this look, from the same store searches as Shop My Look (cached for a day).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/outfits/${look.id}/products`, { cache: 'no-store' });
        const parsed = res.ok ? lookProductMatchesSchema.safeParse(await res.json()) : null;
        if (cancelled) return;
        if (!parsed?.success) return setState({ kind: 'unavailable' });
        setState({ kind: 'ready', matches: parsed.data });
        setOutfit(initialOutfit(parsed.data, slots, picks, start));
      } catch {
        if (!cancelled) setState({ kind: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
    // Loaded once per look; `start` and `picks` only seed the first outfit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look.id]);

  // Read each worn item's colour from its picture, once.
  useEffect(() => {
    for (const item of outfit) {
      const url = item.listing.imageUrl;
      if (!url || colours[url]) continue;
      itemColour(url).then((hex) => {
        if (hex) setColours((c) => (c[url] ? c : { ...c, [url]: hex }));
      });
    }
  }, [outfit, colours]);

  const dressed = useMemo(
    () => outfit.map((w) => ({ ...w, colour: (w.listing.imageUrl && colours[w.listing.imageUrl]) || w.colour })),
    [outfit, colours],
  );

  const activeTab = tab ?? slots[0]?.slotId ?? null;
  const activeSlot = slots.find((s) => s.slotId === activeTab);
  const tabListings = state.kind === 'ready' && activeSlot ? allListings(state.matches, activeSlot.slotId) : [];
  const isWorn = (slotId: string, listing: ProductListing) =>
    outfit.some((w) => w.slotId === slotId && sameListing(w.listing, listing));
  const total = outfit.reduce((sum, w) => sum + w.listing.price, 0);
  const aiItems = layered(outfit).map((w) => ({
    slotId: w.slotId,
    store: w.listing.store,
    title: w.listing.title,
    price: w.listing.price,
  }));
  const outfitKey = aiItems.map((i) => `${i.slotId}|${i.store}|${i.title}|${i.price}`).join('\n');

  function toggle(slot: Slot, listing: ProductListing) {
    setRealistic(false);
    setOutfit((current) =>
      isWorn(slot.slotId, listing) ? takeOff(current, slot.slotId) : wear(current, worn(slot, listing)),
    );
  }

  const description =
    dressed.length > 0
      ? `3D mannequin wearing ${layered(dressed)
          .map((w) => w.listing.title)
          .join(', ')}`
      : '3D mannequin, not dressed yet';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,18rem)]">
      {/* Clothes from Shop My Look */}
      <Card className="order-2 space-y-3 p-3 lg:order-1" aria-labelledby="fitting-clothes">
        <h2 id="fitting-clothes" className="flex items-center gap-2 font-medium">
          <Shirt aria-hidden className="size-4 text-plum" /> Clothes from Shop My Look
        </h2>
        <div role="tablist" aria-label="Part of the look" className="flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <button
              key={slot.slotId}
              type="button"
              role="tab"
              aria-selected={slot.slotId === activeTab}
              onClick={() => setTab(slot.slotId)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                slot.slotId === activeTab
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-plum/60',
              )}
            >
              {slotName(slot)}
            </button>
          ))}
        </div>
        {state.kind === 'loading' && (
          <p role="status" className="text-sm text-muted-foreground">
            Finding the clothes for this look…
          </p>
        )}
        {state.kind === 'unavailable' && (
          <Alert>The clothes for this look couldn’t be loaded. Please go back to Shop My Look and try again.</Alert>
        )}
        {state.kind === 'ready' && activeSlot && (
          <ul
            aria-label={`${slotName(activeSlot)} items`}
            className="grid max-h-[36rem] grid-cols-2 gap-2 overflow-y-auto pr-1"
          >
            {tabListings.length === 0 && (
              <li className="col-span-2 text-sm text-muted-foreground">No items found for this part of the look.</li>
            )}
            {tabListings.map((listing) => {
              const on = isWorn(activeSlot.slotId, listing);
              return (
                <li key={`${listing.store}|${listing.title}|${listing.price}`}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!listing.imageUrl}
                    onClick={() => toggle(activeSlot, listing)}
                    className={cn(
                      'relative flex w-full flex-col gap-1 rounded-lg border p-1.5 text-left text-[11px] transition-colors disabled:opacity-50',
                      on ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-plum/60',
                    )}
                  >
                    {listing.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- the store's Google-hosted thumbnail
                      <img
                        src={listing.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-square w-full rounded-md bg-surface-muted object-contain"
                      />
                    ) : (
                      <span aria-hidden className="block aspect-square w-full rounded-md bg-surface-muted" />
                    )}
                    {on && (
                      <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check aria-hidden className="size-3" />
                      </span>
                    )}
                    <span className="line-clamp-2">{listing.title}</span>
                    <span>
                      <span className="font-medium">{formatInr(listing.price)}</span>{' '}
                      <span className="text-muted-foreground">· {storeName(listing.store)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* The cartoon avatar (AI, the real items) or the 3D mannequin (rotatable, type and colour) */}
      <div className="order-1 space-y-2 lg:order-2">
        {overview.drapeAvailable && (
          <div role="tablist" aria-label="Avatar view" className="flex justify-center gap-2">
            {(
              [
                ['model', 'Model', UserRound],
                ['3d', '3D mannequin', Box],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm',
                  view === id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:border-plum/60',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </button>
            ))}
          </div>
        )}
        {overview.drapeAvailable && view === 'model' ? (
          <ModelViews outfitId={look.id} department={department} items={aiItems} loading={state.kind === 'loading'} />
        ) : (
          <>
            <Mannequin3D department={department} proportions={proportions} outfit={dressed} label={description} />
            <p className="text-center text-xs text-muted-foreground">
              3D preview of each item’s type and colour on a mannequin — not the exact print, fit or drape. Drag to turn
              it, pinch or scroll to zoom.
            </p>
          </>
        )}
      </div>

      {/* Your outfit */}
      <Card className="order-3 space-y-3 p-3" aria-labelledby="fitting-outfit">
        <div className="flex items-center justify-between gap-2">
          <h2 id="fitting-outfit" className="font-medium">
            Your outfit
          </h2>
          {outfit.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setOutfit([])}>
              <RotateCcw aria-hidden /> Reset
            </Button>
          )}
        </div>
        {outfit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Pick an item on the left to put it on the mannequin.</p>
        ) : (
          <ul className="space-y-2">
            {layered(dressed).map((w) => {
              const slot = slots.find((s) => s.slotId === w.slotId)!;
              return (
                <li key={w.slotId} className="flex gap-2 rounded-lg border border-border p-2 text-xs">
                  {w.listing.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- the store's Google-hosted thumbnail
                    <img
                      src={w.listing.imageUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="size-14 shrink-0 rounded-md bg-surface-muted object-contain"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-muted-foreground">{slotName(slot)}</p>
                    <p className="line-clamp-2">{w.listing.title}</p>
                    <p className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="inline-block size-3 rounded-full border border-border"
                        style={{ backgroundColor: w.colour }}
                      />
                      <span className="font-medium">{formatInr(w.listing.price)}</span>
                      <span className="text-muted-foreground">· {storeName(w.listing.store)}</span>
                    </p>
                    {w.listing.link && (
                      <a
                        href={w.listing.link}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-plum underline underline-offset-2"
                      >
                        View on Google Shopping
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Take off ${w.listing.title}`}
                    onClick={() => {
                      setRealistic(false);
                      setOutfit((current) => takeOff(current, w.slotId));
                    }}
                    className="self-start rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {outfit.length > 0 && (
          <p className="border-t border-border pt-2 text-sm">
            Total: <span className="font-medium">{formatInr(total)}</span>
            <span className="block text-xs text-muted-foreground">
              Search-result prices; they can change and aren’t a checkout price.
            </span>
          </p>
        )}
        {outfit.length > 0 && !realistic && (
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setRealistic(true)}>
            <Sparkles aria-hidden /> Make it realistic with AI
          </Button>
        )}
      </Card>

      {realistic && outfit.length > 0 && (
        <div className="order-4 lg:col-span-3">
          <TryOnStudio
            key={outfitKey}
            overview={overview}
            outfitId={look.id}
            items={aiItems}
            subject={aiItems.map((i) => i.title).join(' + ')}
          />
        </div>
      )}
    </div>
  );
}
