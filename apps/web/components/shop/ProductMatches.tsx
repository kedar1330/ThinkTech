'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import {
  CATEGORIES,
  PRICE_RANGE_STORES,
  lookProductMatchesSchema,
  type Look,
  type LookPick,
  type LookProductMatches,
  type PriceRangeStore,
  type ProductListing,
} from '@styleme/contracts';
import { pickProductAction, unpickProductAction, type PicksResult } from '@/app/actions/shop';
import { Alert } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { TryOnButton } from './TryOnButton';
import { garmentSlots, slotLabel, vocabLabel } from '@/lib/outfits/look-text';
import { formatInr } from '@/lib/shop/format';
import { cn } from '@/lib/utils';

type State = { kind: 'loading' } | { kind: 'ready'; matches: LookProductMatches } | { kind: 'unavailable' };
type StoreFilter = 'all' | PriceRangeStore;

const storeName = (id: PriceRangeStore) => PRICE_RANGE_STORES.find((s) => s.id === id)!.label;
const pickKey = (l: ProductListing) => `${l.store}|${l.title}|${l.price}`;

/**
 * Similar products for each garment of the look (#120), from Amazon, Flipkart and Meesho search results:
 * the store's own title, thumbnail and price, cheapest first, with each store's price spread. The user can
 * pick one per garment to compare totals with the cheapest picks and their budget per look; picks are saved on
 * the look. Clicking an item opens its options: save it to the look, Virtual Try-On, and its Google Shopping page
 * (#125). Only real listings are shown, always with the label; without them, `fallback` is shown.
 */
export function ProductMatches({
  look,
  budget,
  fallback,
  initialPicks = [],
}: {
  look: Pick<Look, 'id' | 'slots'>;
  budget: number | null;
  fallback: React.ReactNode;
  /** The picks saved on the look. */
  initialPicks?: readonly LookPick[];
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [store, setStore] = useState<StoreFilter>('all');
  const [picks, setPicks] = useState<Record<string, ProductListing>>(() =>
    Object.fromEntries(initialPicks.map((p) => [p.slotId, p])),
  );
  const [pickError, setPickError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  /** The one item whose options are open (#125): `<slotId>|<item>`. */
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Escape closes the open options and returns focus to the item.
  useEffect(() => {
    if (!openKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const toggle = document.querySelector<HTMLButtonElement>('[aria-expanded="true"][aria-controls^="options-"]');
      setOpenKey(null);
      toggle?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKey]);

  /** Shows the change at once, saves it, and puts the picks back if saving fails. */
  const togglePick = (slotId: string, listing: ProductListing, picked: boolean) => {
    const before = picks;
    setPickError(null);
    setPicks((p) => {
      const next = { ...p };
      if (picked) delete next[slotId];
      else next[slotId] = listing;
      return next;
    });
    startSaving(async () => {
      const result: PicksResult = picked
        ? await unpickProductAction(look.id, slotId)
        : await pickProductAction(look.id, slotId, listing);
      if (result.error !== undefined) {
        setPicks(before);
        setPickError(result.error);
      } else {
        setPicks(Object.fromEntries(result.picks.map((p) => [p.slotId, p])));
      }
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/outfits/${look.id}/products`, { cache: 'no-store' });
        const parsed = res.ok ? lookProductMatchesSchema.safeParse(await res.json()) : null;
        if (!cancelled) setState(parsed?.success ? { kind: 'ready', matches: parsed.data } : { kind: 'unavailable' });
      } catch {
        if (!cancelled) setState({ kind: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [look.id]);

  const garments = useMemo(() => new Map(garmentSlots(look).map((s) => [s.slotId, s])), [look]);

  if (state.kind === 'unavailable') return <>{fallback}</>;
  if (state.kind === 'loading') {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Finding similar items on Amazon, Flipkart and Meesho…
      </p>
    );
  }

  const { matches } = state;
  const cheapest = matches.slots.map((s) => s.listings[0]?.price).filter((p): p is number => p !== undefined);
  const cheapestTotal = cheapest.reduce((sum, p) => sum + p, 0);
  const picked = Object.values(picks);
  const pickedTotal = picked.reduce((sum, l) => sum + l.price, 0);
  const pricedSlots = matches.slots.filter((s) => s.listings.length > 0).length;

  return (
    <section aria-labelledby="similar-items" className="space-y-4">
      <div className="space-y-1">
        <h2 id="similar-items" className="font-display text-2xl text-primary">
          Similar items to compare
        </h2>
        <p className="text-xs text-muted-foreground">{matches.label}</p>
      </div>

      <div role="group" aria-label="Store" className="flex flex-wrap gap-2">
        {(['all', ...PRICE_RANGE_STORES.map((s) => s.id)] as StoreFilter[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={store === id}
            onClick={() => setStore(id)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              store === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-plum/60',
            )}
          >
            {id === 'all' ? 'All stores' : storeName(id)}
          </button>
        ))}
      </div>

      <Card className="space-y-1 p-4 text-sm" role="group" aria-label="Compare totals">
        {pricedSlots > 0 ? (
          <p>
            Cheapest found for{' '}
            {pricedSlots === matches.slots.length ? 'this look' : `${pricedSlots} of ${matches.slots.length} pieces`}:{' '}
            <span className="font-medium">{formatInr(cheapestTotal)}</span>
          </p>
        ) : (
          <p className="text-muted-foreground">No similar items found on Amazon, Flipkart or Meesho.</p>
        )}
        {picked.length > 0 && (
          <p>
            Your picks ({picked.length} of {matches.slots.length}):{' '}
            <span className="font-medium">{formatInr(pickedTotal)}</span>
            {budget !== null &&
              (pickedTotal <= budget
                ? ` — within your ${formatInr(budget)} budget per look, ${formatInr(budget - pickedTotal)} left.`
                : ` — over your ${formatInr(budget)} budget per look by ${formatInr(pickedTotal - budget)}.`)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Search-result prices; they can change and aren’t a checkout price. Your picks are saved with this look.
        </p>
        {pickError && <Alert tone="error">{pickError}</Alert>}
      </Card>

      {matches.slots.map((slot) => {
        const garment = garments.get(slot.slotId);
        const name = garment ? vocabLabel(CATEGORIES, garment.lookSpec.category) : slotLabel(slot.slotId);
        const shown = slot.listings.filter((l) => store === 'all' || l.store === store);
        const headingId = `similar-${slot.slotId}`;
        return (
          <section key={slot.slotId} aria-labelledby={headingId} className="space-y-2">
            <h3 id={headingId} className="font-medium">
              {name}
              {garment && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">{garment.searchPhrase}</span>
              )}
            </h3>
            {slot.stats.length > 0 && (
              <ul
                aria-label={`Prices by store for ${name}`}
                className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
              >
                {slot.stats.map((s) => (
                  <li key={s.store}>
                    {storeName(s.store)}: {s.listings} found, {formatInr(s.min)} – {formatInr(s.max)} (typical{' '}
                    {formatInr(s.median)})
                  </li>
                ))}
              </ul>
            )}
            {shown.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No similar items found{store === 'all' ? '' : ` on ${storeName(store)}`}.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {shown.map((l, i) => {
                  const isPicked = picks[slot.slotId] && pickKey(picks[slot.slotId]!) === pickKey(l);
                  const optionsKey = `${slot.slotId}|${pickKey(l)}`;
                  const open = openKey === optionsKey;
                  const optionsId = `options-${slot.slotId}-${i}`;
                  return (
                    <li
                      key={pickKey(l)}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border p-2 text-xs',
                        isPicked ? 'border-primary ring-1 ring-primary' : 'border-border',
                      )}
                    >
                      {/* The item itself opens its options (#125). */}
                      <button
                        type="button"
                        id={`${optionsId}-toggle`}
                        aria-expanded={open}
                        aria-controls={optionsId}
                        onClick={() => setOpenKey(open ? null : optionsKey)}
                        className="flex flex-col gap-2 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {l.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the store's Google-hosted thumbnail, as the search returned it
                          <img
                            src={l.imageUrl}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="aspect-square w-full rounded-lg bg-surface-muted object-contain"
                          />
                        ) : (
                          <span aria-hidden className="block aspect-square w-full rounded-lg bg-surface-muted" />
                        )}
                        <span className="line-clamp-2 text-foreground">{l.title}</span>
                        <span>
                          <span className="text-sm font-medium text-foreground">{formatInr(l.price)}</span>{' '}
                          <span className="text-muted-foreground">· {storeName(l.store)}</span>
                        </span>
                      </button>
                      {open ? (
                        <div
                          id={optionsId}
                          role="group"
                          aria-label={`Options for ${l.title}`}
                          className="mt-auto flex flex-col gap-2 rounded-lg bg-surface-muted p-2"
                        >
                          <button
                            type="button"
                            aria-pressed={Boolean(isPicked)}
                            disabled={saving}
                            onClick={() => togglePick(slot.slotId, l, Boolean(isPicked))}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                          >
                            <Heart aria-hidden className="size-3.5" />
                            {isPicked ? 'Saved to this look' : 'Save to this look'}
                          </button>
                          {/* Coming soon until Virtual Try-On is built; then it opens with this garment (#124). */}
                          <TryOnButton outfitId={look.id} lookName={l.title} slotId={slot.slotId} />
                          {l.link && (
                            <a
                              href={l.link}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="text-center text-plum underline underline-offset-2"
                            >
                              View on Google Shopping
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="mt-auto">
                          <TryOnButton outfitId={look.id} lookName={l.title} slotId={slot.slotId} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
