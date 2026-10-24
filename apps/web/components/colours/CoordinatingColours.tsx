'use client';

import { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import type { CoordinatingColours as Coordinating, MyColourCombinationsResponse } from '@styleme/contracts';
import { textContrastColor } from '@/lib/palette/palette-utils';
import { cn } from '@/lib/utils';

type OwnColour = MyColourCombinationsResponse['colours'][number];

/**
 * Coordinating colours (#105): choose one of your colours to see the colours from your own palette that go well
 * with it, best first. Liked colours are listed first in the picker; avoided colours are never offered.
 */
export function CoordinatingColours({
  colours,
  coordinating,
  garment = null,
}: {
  colours: OwnColour[];
  coordinating: Coordinating[];
  garment?: string | null;
}) {
  const ordered = [
    ...colours.filter((c) => c.preference === 'liked'),
    ...colours.filter((c) => c.preference !== 'liked'),
  ];
  const [selectedId, setSelectedId] = useState(ordered[0]?.colourId ?? null);
  const byId = new Map(colours.map((c) => [c.colourId, c]));
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const matches = (coordinating.find((c) => c.colourId === selectedId)?.matches ?? []).flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });

  if (!selected) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No colours to match yet.
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section aria-labelledby="coordinating-pick-heading" className="space-y-3">
        <h2 id="coordinating-pick-heading" className="text-sm font-medium text-foreground">
          Choose one of your colours
        </h2>
        <div role="radiogroup" aria-label="Your colours" className="flex max-h-96 flex-wrap gap-2 overflow-y-auto p-1">
          {ordered.map((c) => (
            <button
              key={c.colourId}
              type="button"
              role="radio"
              aria-checked={c.colourId === selectedId}
              aria-label={`${c.name}, ${c.hex}${c.preference === 'liked' ? ', liked' : ''}`}
              title={c.name}
              onClick={() => setSelectedId(c.colourId)}
              className={cn(
                'relative size-10 rounded-full border border-black/10 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                c.colourId === selectedId ? 'ring-2 ring-plum ring-offset-2' : 'hover:shadow-md',
              )}
              style={{ backgroundColor: c.hex }}
            >
              {c.preference === 'liked' && (
                <Heart
                  aria-hidden
                  className="absolute -right-1 -top-1 size-4 rounded-full bg-surface p-0.5 fill-current text-plum"
                />
              )}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="coordinating-matches-heading" className="space-y-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-14 shrink-0 rounded-xl border border-black/10"
            style={{ backgroundColor: selected.hex }}
          />
          <div className="min-w-0">
            <h2 id="coordinating-matches-heading" className="font-display text-2xl text-primary">
              Goes with {selected.name}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">{selected.hex}</p>
          </div>
        </div>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No close matches in your colours for this one.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {matches.map((m) => (
              <li key={m.colourId} className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
                <span
                  className="flex h-20 items-end justify-between p-2"
                  style={{ backgroundColor: m.hex, color: textContrastColor(m.hex) }}
                >
                  <span
                    aria-hidden
                    className="size-5 rounded-full border-2 border-current"
                    style={{ backgroundColor: selected.hex }}
                  />
                  {m.preference === 'liked' && <Heart aria-label="liked" className="size-4 fill-current" />}
                </span>
                <span className="block space-y-0.5 px-2.5 py-2">
                  <span className="block truncate text-sm font-medium text-foreground">{m.name}</span>
                  <span className="block font-mono text-[11px] text-muted-foreground">{m.hex}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const names = [selected.name, m.name];
                      const hexes = [selected.hex, m.hex];
                      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
                      const g = garment || params.get('garment');
                      const gParam = g ? `&from=design&garment=${encodeURIComponent(g)}` : '';
                      window.location.href = `/discover/looks?colors=${encodeURIComponent(names.join(','))}&colorHexes=${encodeURIComponent(hexes.join(','))}${gParam}`;
                    }}
                    className="inline-flex items-center gap-1 pt-1 text-[11px] font-semibold text-plum hover:underline"
                  >
                    <Sparkles className="size-2.5" />
                    Use pair in Discover
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
