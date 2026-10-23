'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CATEGORIES,
  PRICE_RANGE_STORES,
  lookProductMatchesSchema,
  type Look,
  type LookProductMatches,
  type PriceRangeStore,
  type ProductListing,
} from '@styleme/contracts';
import { Card } from '@/components/ui/card';
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
 * pick one per garment to compare totals with the cheapest picks and their budget per look. Picks stay on
 * this page. Only real listings are shown, always with the label; without them, `fallback` is shown.
 */
export function ProductMatches({
  look,
  budget,
  fallback,
}: {
  look: Pick<Look, 'id' | 'slots'>;
  budget: number | null;
  fallback: React.ReactNode;
}) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [store, setStore] = useState<StoreFilter>('all');
  const [picks, setPicks] = useState<Record<string, ProductListing>>({});

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
          Search-result prices; they can change and aren’t a checkout price.
        </p>
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
                {shown.map((l) => {
                  const isPicked = picks[slot.slotId] && pickKey(picks[slot.slotId]!) === pickKey(l);
                  return (
                    <li
                      key={pickKey(l)}
                      className={cn(
                        'flex flex-col gap-2 rounded-xl border p-2 text-xs',
                        isPicked ? 'border-primary ring-1 ring-primary' : 'border-border',
                      )}
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
                        <div aria-hidden className="aspect-square w-full rounded-lg bg-surface-muted" />
                      )}
                      <p className="line-clamp-2 text-foreground">{l.title}</p>
                      <p>
                        <span className="text-sm font-medium text-foreground">{formatInr(l.price)}</span>{' '}
                        <span className="text-muted-foreground">· {storeName(l.store)}</span>
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          aria-pressed={Boolean(isPicked)}
                          aria-label={`${isPicked ? 'Unpick' : 'Pick'} ${l.title} for ${name}`}
                          onClick={() =>
                            setPicks((p) => {
                              const next = { ...p };
                              if (isPicked) delete next[slot.slotId];
                              else next[slot.slotId] = l;
                              return next;
                            })
                          }
                          className="rounded-full border border-border px-2.5 py-0.5 hover:border-plum/60"
                        >
                          {isPicked ? 'Picked' : 'Pick'}
                        </button>
                        {l.link && (
                          <a
                            href={l.link}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="text-plum underline underline-offset-2"
                          >
                            View on Google Shopping
                          </a>
                        )}
                      </div>
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
