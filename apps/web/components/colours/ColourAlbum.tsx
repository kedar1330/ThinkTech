'use client';

import { useMemo, useState, useTransition } from 'react';
import { Ban, Check, Heart, Sparkles, X } from 'lucide-react';
import {
  COLOUR_FAMILIES,
  COLOUR_LIBRARY_LIMITS,
  type ColourFamily,
  type ColourItem,
  type ColourPreference,
} from '@styleme/contracts';
import { setColourPreferenceAction } from '@/app/actions/colours';
import { Button } from '@/components/ui/button';
import { textContrastColor } from '@/lib/palette/palette-utils';
import { cn } from '@/lib/utils';

export type AlbumColour = ColourItem & { score?: number; reasons?: string[] };

type PreferenceFilter = 'all' | 'liked' | 'avoided' | 'unmarked';

const PREFERENCE_FILTERS: Array<{ id: PreferenceFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'liked', label: 'Liked' },
  { id: 'avoided', label: 'Avoided' },
  { id: 'unmarked', label: 'Not marked' },
];

/**
 * Colour grid (D-133). Works like selecting photos in an album: tap colours to select several, then
 * save them as liked or to avoid, or clear them. With one colour selected, its reasons are shown. In `saved`
 * mode, cleared colours leave the list.
 */
export function ColourAlbum({
  colours,
  mode = 'category',
  fromDiscover = false,
  garment = null,
}: {
  colours: AlbumColour[];
  mode?: 'category' | 'saved';
  fromDiscover?: boolean;
  garment?: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Map<string, ColourPreference | null>>(new Map());
  const [family, setFamily] = useState<ColourFamily | 'all'>('all');
  const [prefFilter, setPrefFilter] = useState<PreferenceFilter>('all');
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const withPrefs = useMemo(
    () =>
      colours
        .map((c) => ({ ...c, preference: overrides.has(c.colourId) ? overrides.get(c.colourId)! : c.preference }))
        .filter((c) => mode === 'category' || c.preference !== null),
    [colours, overrides, mode],
  );
  const families = COLOUR_FAMILIES.map((f) => ({
    ...f,
    count: withPrefs.filter((c) => c.family === f.id).length,
  })).filter((f) => f.count > 0);
  const shown = withPrefs.filter(
    (c) =>
      (family === 'all' || c.family === family) &&
      (prefFilter === 'all' || (prefFilter === 'unmarked' ? c.preference === null : c.preference === prefFilter)),
  );
  const selectedColours = withPrefs.filter((c) => selected.has(c.colourId));
  const single = selectedColours.length === 1 ? selectedColours[0]! : null;

  function toggle(id: string) {
    setStatus(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < COLOUR_LIBRARY_LIMITS.perRequest) next.add(id);
      return next;
    });
  }

  function apply(preference: ColourPreference | 'none') {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await setColourPreferenceAction(ids, preference);
      if (result?.error) {
        setStatus({ kind: 'error', text: result.error });
        return;
      }
      setOverrides((prev) => {
        const next = new Map(prev);
        for (const id of ids) next.set(id, preference === 'none' ? null : preference);
        return next;
      });
      setSelected(new Set());
      setStatus({ kind: 'success', text: result?.success ?? 'Saved.' });
    });
  }

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-surface-muted',
    );

  const navigateToDiscover = (chosenColours: AlbumColour[]) => {
    const names = chosenColours.map((c) => c.name);
    const hexes = chosenColours.map((c) => c.hex);
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    const g = garment || params.get('garment');
    const gParam = g ? `&from=design&garment=${encodeURIComponent(g)}` : '';
    window.location.href = `/discover/looks?colors=${encodeURIComponent(names.join(','))}&colorHexes=${encodeURIComponent(hexes.join(','))}${gParam}`;
  };

  return (
    <div className="space-y-4">
      {fromDiscover && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-plum/30 bg-plum/5 p-4 text-xs text-foreground shadow-2xs">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-plum shrink-0" />
            <span>
              <strong>Choose outfit colours:</strong> Tap any colours below to select them for your Discover My Style
              look, then click <strong>"Use in Discover My Style"</strong>.
            </span>
          </div>
          <a
            href={`/discover/looks${garment ? `?from=design&garment=${encodeURIComponent(garment)}` : ''}`}
            className="font-semibold text-plum underline hover:text-plum/80"
          >
            Cancel &amp; Return to Discover
          </a>
        </div>
      )}
      <div className="space-y-2">
        <div role="group" aria-label="Filter by colour family" className="flex flex-wrap gap-2">
          <button
            type="button"
            className={chip(family === 'all')}
            aria-pressed={family === 'all'}
            onClick={() => setFamily('all')}
          >
            All colours <span className="opacity-70">{withPrefs.length}</span>
          </button>
          {families.map((f) => (
            <button
              key={f.id}
              type="button"
              className={chip(family === f.id)}
              aria-pressed={family === f.id}
              onClick={() => setFamily(f.id)}
            >
              {f.label} <span className="opacity-70">{f.count}</span>
            </button>
          ))}
        </div>
        <div role="group" aria-label="Filter by your choice" className="flex flex-wrap gap-2">
          {PREFERENCE_FILTERS.filter((p) => mode === 'category' || p.id !== 'unmarked').map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(chip(prefFilter === p.id), 'min-h-8 text-xs')}
              aria-pressed={prefFilter === p.id}
              onClick={() => setPrefFilter(p.id)}
            >
              {p.id === 'liked' && <Heart aria-hidden className="size-3.5" />}
              {p.id === 'avoided' && <Ban aria-hidden className="size-3.5" />}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Tap colours to select them, then save them as colours you like or want to avoid.
      </p>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {mode === 'saved' && withPrefs.length === 0
            ? 'You haven’t marked any colours yet. Open My colours to start.'
            : 'No colours match these filters.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((c) => {
            const isSelected = selected.has(c.colourId);
            const ink = textContrastColor(c.hex);
            return (
              <li key={c.colourId} className="min-w-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`${c.name}, ${c.hex}${c.preference ? `, ${c.preference === 'liked' ? 'liked' : 'avoided'}` : ''}`}
                  onClick={() => toggle(c.colourId)}
                  className={cn(
                    'group block w-full overflow-hidden rounded-xl border bg-surface text-left shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isSelected ? 'border-plum ring-2 ring-plum' : 'border-border hover:shadow-md',
                  )}
                >
                  <span className="relative block h-24 sm:h-28" style={{ backgroundColor: c.hex, color: ink }}>
                    {c.preference && (
                      <span
                        className={cn(
                          'absolute left-2 top-2 inline-flex size-7 items-center justify-center rounded-full shadow-sm',
                          c.preference === 'liked' ? 'bg-surface text-plum' : 'bg-foreground/80 text-background',
                        )}
                      >
                        {c.preference === 'liked' ? (
                          <Heart aria-hidden className="size-4 fill-current" />
                        ) : (
                          <Ban aria-hidden className="size-4" />
                        )}
                      </span>
                    )}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute right-2 top-2 inline-flex size-6 items-center justify-center rounded-full border-2 transition-opacity',
                        isSelected
                          ? 'border-surface bg-plum text-primary-foreground opacity-100'
                          : 'border-current opacity-0 group-hover:opacity-70',
                      )}
                    >
                      {isSelected && <Check className="size-3.5" />}
                    </span>
                  </span>
                  <span className="block space-y-0.5 px-2.5 py-2">
                    <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{c.hex}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p aria-live="polite" className="sr-only">
        {status?.text ?? ''}
      </p>

      {(selected.size > 0 || status) && (
        <div className="sticky bottom-4 z-30 mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-3 shadow-xl">
          {single?.reasons && single.reasons.length > 0 && (
            <div className="mb-3 flex gap-3 border-b border-border pb-3">
              <span
                aria-hidden
                className="size-12 shrink-0 rounded-lg border border-black/10"
                style={{ backgroundColor: single.hex }}
              />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-foreground">
                  {single.name} <span className="font-mono text-xs text-muted-foreground">{single.hex}</span>
                  {single.score !== undefined && (
                    <span className="ml-2 text-xs text-plum">Match {single.score}/100</span>
                  )}
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {single.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {selected.size > 0 ? (
              <>
                <span className="mr-auto text-sm font-medium">
                  {selected.size} selected
                  {selected.size === COLOUR_LIBRARY_LIMITS.perRequest && (
                    <span className="ml-1 text-xs text-muted-foreground">(the most at once)</span>
                  )}
                </span>
                <Button
                  size="sm"
                  type="button"
                  className="bg-plum text-white hover:bg-plum/90 font-medium"
                  onClick={() => navigateToDiscover(selectedColours)}
                >
                  <Sparkles aria-hidden className="size-3.5 mr-1" />
                  Use {selected.size} in Discover My Style
                </Button>
                <Button size="sm" disabled={pending} onClick={() => apply('liked')}>
                  <Heart aria-hidden /> Like
                </Button>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => apply('avoided')}>
                  <Ban aria-hidden /> Avoid
                </Button>
                {selectedColours.some((c) => c.preference !== null) && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => apply('none')}>
                    Clear choice
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setSelected(new Set())}
                  aria-label="Deselect all"
                >
                  <X aria-hidden />
                </Button>
              </>
            ) : (
              <>
                <span
                  className={cn('mr-auto text-sm', status?.kind === 'error' ? 'text-destructive' : 'text-foreground')}
                  role={status?.kind === 'error' ? 'alert' : undefined}
                >
                  {status?.text}
                </span>
                <Button size="sm" variant="ghost" onClick={() => setStatus(null)} aria-label="Dismiss">
                  <X aria-hidden />
                </Button>
              </>
            )}
          </div>
          {selected.size > 0 && status?.kind === 'error' && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {status.text}
            </p>
          )}
          {selected.size > 0 && (
            <button
              type="button"
              className="mt-2 text-xs text-plum underline underline-offset-2"
              onClick={() =>
                setSelected(new Set(shown.slice(0, COLOUR_LIBRARY_LIMITS.perRequest).map((c) => c.colourId)))
              }
            >
              Select all {Math.min(shown.length, COLOUR_LIBRARY_LIMITS.perRequest)} shown
            </button>
          )}
        </div>
      )}
    </div>
  );
}
