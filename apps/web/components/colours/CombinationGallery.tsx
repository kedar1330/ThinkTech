'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import type { ColourCombination, CombinationHarmony, CombinationRole } from '@styleme/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 24;

const ROLE_LABEL: Record<CombinationRole, string> = { base: 'Base', accent: 'Accent', pop: 'Pop' };
/** The base covers most of the outfit, the pop the least. */
const ROLE_WEIGHT: Record<CombinationRole, number> = { base: 3, accent: 2, pop: 1 };

export interface CombinationGalleryProps {
  combinations: ColourCombination[];
  harmonies: Array<{ id: CombinationHarmony; label: string; count: number }>;
}

/**
 * Curated combinations (#105): two- and three-colour outfits built only from the user's own colours, best first,
 * filterable by harmony and by colours the user likes.
 */
export function CombinationGallery({ combinations, harmonies }: CombinationGalleryProps) {
  const [harmony, setHarmony] = useState<CombinationHarmony | 'all'>('all');
  const [likedOnly, setLikedOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const labels = new Map(harmonies.map((h) => [h.id, h.label]));
  const shown = combinations.filter(
    (c) => (harmony === 'all' || c.harmony === harmony) && (!likedOnly || c.likedCount > 0),
  );
  const likedTotal = combinations.filter((c) => c.likedCount > 0).length;

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-surface-muted',
    );
  const choose = (next: () => void) => {
    next();
    setLimit(PAGE_SIZE);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div role="group" aria-label="Filter by harmony" className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(harmony === 'all')}
            aria-pressed={harmony === 'all'}
            onClick={() => choose(() => setHarmony('all'))}
          >
            All <span className="opacity-70">{combinations.length}</span>
          </button>
          {harmonies.map((h) => (
            <button
              key={h.id}
              type="button"
              className={chip(harmony === h.id)}
              aria-pressed={harmony === h.id}
              onClick={() => choose(() => setHarmony(h.id))}
            >
              {h.label} <span className="opacity-70">{h.count}</span>
            </button>
          ))}
        </div>
        {likedTotal > 0 && (
          <button
            type="button"
            className={cn(chip(likedOnly), 'min-h-8 text-xs')}
            aria-pressed={likedOnly}
            onClick={() => choose(() => setLikedOnly((v) => !v))}
          >
            <Heart aria-hidden className="size-3.5" /> With colours I like
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No combinations match these filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.slice(0, limit).map((c) => (
            <li key={c.combinationId} className="min-w-0">
              <article
                aria-label={c.colours.map((col) => col.name).join(', ')}
                className="h-full overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
              >
                <div aria-hidden className="flex h-24">
                  {c.colours.map((col) => (
                    <span
                      key={col.colourId}
                      style={{ backgroundColor: col.hex, flexGrow: ROLE_WEIGHT[col.role] }}
                      className="basis-0"
                    />
                  ))}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-plum">{labels.get(c.harmony)}</p>
                    <p className="text-xs text-muted-foreground">Match {c.score}/100</p>
                  </div>
                  <ul className="space-y-1">
                    {c.colours.map((col) => (
                      <li key={col.colourId} className="flex min-w-0 items-center gap-2 text-sm">
                        <span
                          aria-hidden
                          className="size-4 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span className="truncate font-medium text-foreground">{col.name}</span>
                        {col.preference === 'liked' && (
                          <Heart aria-label="liked" className="size-3.5 shrink-0 fill-current text-plum" />
                        )}
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                          {ROLE_LABEL[col.role]} · {col.hex}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {shown.length > limit && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show more ({shown.length - limit} left)
          </Button>
        </div>
      )}
    </div>
  );
}
