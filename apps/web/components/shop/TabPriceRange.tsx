'use client';

import { useEffect, useRef, useState } from 'react';
import { PRICE_RANGE_STORES, lookPriceRangeSchema, type LookPriceRange } from '@styleme/contracts';
import { formatInr } from '@/lib/shop/format';

type State = { kind: 'loading' } | { kind: 'ready'; range: LookPriceRange } | { kind: 'unavailable' };

const storeNames = (ids: readonly string[]) =>
  PRICE_RANGE_STORES.filter((s) => ids.includes(s.id))
    .map((s) => s.label)
    .join(', ');

const checkedAt = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * The look's price range on its Shop My Look tab (#118), from Amazon, Flipkart and Meesho search results
 * through our route handler. It loads once the tab scrolls into view, so a long strip doesn't search every
 * look at once. Only real listing prices are shown, always with their label; without them, it says so.
 */
export function TabPriceRange({ outfitId }: { outfitId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/outfits/${outfitId}/price-range`, { cache: 'no-store' });
        const range = res.ok ? lookPriceRangeSchema.safeParse(await res.json()) : null;
        if (!cancelled) setState(range?.success ? { kind: 'ready', range: range.data } : { kind: 'unavailable' });
      } catch {
        if (!cancelled) setState({ kind: 'unavailable' });
      }
    };
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      void load();
      return () => {
        cancelled = true;
      };
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        void load();
      }
    });
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [outfitId]);

  return (
    <div ref={ref} className="space-y-1 text-xs" aria-live="polite" data-testid="tab-price-range">
      {state.kind === 'loading' && <p className="text-muted-foreground">Checking prices…</p>}
      {state.kind === 'unavailable' && <p className="text-muted-foreground">Price range unavailable</p>}
      {state.kind === 'ready' && <RangeText range={state.range} />}
    </div>
  );
}

function RangeText({ range }: { range: LookPriceRange }) {
  if (range.min === null || range.max === null) {
    return <p className="text-muted-foreground">No prices found on Amazon, Flipkart or Meesho</p>;
  }
  const amount = range.min === range.max ? formatInr(range.min) : `${formatInr(range.min)} – ${formatInr(range.max)}`;
  const scope =
    range.pricedSlots === range.totalSlots ? 'for this look' : `for ${range.pricedSlots} of ${range.totalSlots} pieces`;
  return (
    <>
      <p className="text-sm font-medium text-foreground">
        {amount} <span className="text-xs font-normal text-muted-foreground">{scope}</span>
      </p>
      <p className="text-muted-foreground">
        On {storeNames(range.stores)} · checked {checkedAt(range.checkedAt)}
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">{range.label}</p>
    </>
  );
}
