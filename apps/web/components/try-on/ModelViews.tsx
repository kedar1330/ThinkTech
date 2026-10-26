'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  DRAPE_LABEL,
  DRAPE_VIEWS,
  DRAPE_VIEW_LABELS,
  type AvatarDepartment,
  type DrapeView,
  type TryOnOutfitItem,
} from '@styleme/contracts';
import { drapeAction, drapeViewAction } from '@/app/actions/try-on';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/** Waits for clicks to settle before dressing, so quick changes cost one drape, not several. */
const SETTLE_MS = 250;
const OTHER_VIEWS = DRAPE_VIEWS.filter((v): v is Exclude<DrapeView, 'front'> => v !== 'front');

type Dressed = { kind: 'dressed'; id: string } | { kind: 'error'; message: string };
type ViewState = 'drawing' | 'ready' | 'failed';

/**
 * The try-on model (D-138, D-139), shown like a studio turntable: a strip of views on the left (front,
 * three-quarter, side, back) and the chosen view large. Whenever the outfit changes, the model is dressed in its
 * real items (about 10–20 seconds per garment); the other angles are then drawn from the dressed front, side by
 * side. Only the latest outfit's pictures are shown; a late reply for an older outfit is ignored.
 */
export function ModelViews({
  outfitId,
  department,
  items,
  loading,
}: {
  outfitId: string;
  department: AvatarDepartment;
  /** The outfit, layered from the body out; empty shows the undressed model. */
  items: readonly TryOnOutfitItem[];
  loading?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<DrapeView>('front');
  const latest = useRef(0);
  const key = `${department}\n${attempt}\n${items.map((i) => `${i.slotId}|${i.store}|${i.title}|${i.price}`).join('\n')}`;
  // The reply for the outfit it was asked for; any other outfit is still being dressed.
  const [result, setResult] = useState<{ key: string; dressed: Dressed } | null>(null);
  const [views, setViews] = useState<{ id: string; states: Partial<Record<DrapeView, ViewState>> } | null>(null);

  const dressing = items.length > 0 && result?.key !== key;
  const dressed = items.length > 0 && result?.key === key ? result.dressed : null;
  const drapeId = dressed?.kind === 'dressed' ? dressed.id : null;
  const viewStates = drapeId && views?.id === drapeId ? views.states : {};

  // Dress the model whenever the outfit changes.
  useEffect(() => {
    const request = ++latest.current;
    if (items.length === 0) return;
    const timer = setTimeout(async () => {
      const res = await drapeAction({ outfitId, department, items: [...items] });
      if (request !== latest.current) return;
      setResult({
        key,
        dressed: res.drape ? { kind: 'dressed', id: res.drape.id } : { kind: 'error', message: res.error ?? '' },
      });
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `key` stands for `items`, the department and the retry count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, outfitId]);

  // Then draw the other angles from the dressed front, all at once.
  useEffect(() => {
    if (!drapeId) return;
    let cancelled = false;
    for (const view of OTHER_VIEWS) {
      drapeViewAction(drapeId, view).then((res) => {
        if (cancelled) return;
        setViews((current) => ({
          id: drapeId,
          states: { ...(current?.id === drapeId ? current.states : {}), [view]: res.ok ? 'ready' : 'failed' },
        }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [drapeId]);

  const stateOf = (view: DrapeView): ViewState | 'base' => {
    if (view === 'front') return drapeId ? 'ready' : dressing ? 'drawing' : 'base';
    if (!drapeId) return dressing ? 'drawing' : 'base';
    return viewStates[view] ?? 'drawing';
  };
  const srcOf = (view: DrapeView) =>
    drapeId && stateOf(view) === 'ready'
      ? `/api/try-on/drapes/${drapeId}/image?view=${view}`
      : attempt > 0
        ? `/api/try-on/avatars/${department}?t=${attempt}`
        : `/api/try-on/avatars/${department}`;
  // A view that isn't ready shows the front meanwhile.
  const shown: DrapeView = stateOf(selected) === 'ready' ? selected : 'front';
  const garments = items.map((i) => i.title).join(', ');
  const step = (by: number) =>
    setSelected((v) => DRAPE_VIEWS[(DRAPE_VIEWS.indexOf(v) + by + DRAPE_VIEWS.length) % DRAPE_VIEWS.length]!);

  return (
    <div className="space-y-2">
      <div
        className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]"
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            step(e.key === 'ArrowUp' ? -1 : 1);
          }
        }}
      >
        <div className="flex flex-col items-center gap-1.5 rounded-xl bg-surface-muted p-1.5">
          <button
            type="button"
            aria-label="Previous view"
            onClick={() => step(-1)}
            className="rounded-full p-1 text-plum hover:bg-surface"
          >
            <ChevronUp aria-hidden className="size-5" />
          </button>
          <div role="tablist" aria-label="Views" aria-orientation="vertical" className="flex flex-col gap-1.5">
            {DRAPE_VIEWS.map((view) => {
              const state = stateOf(view);
              return (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={selected === view}
                  aria-label={`${DRAPE_VIEW_LABELS[view]} view${state === 'drawing' ? ' (drawing…)' : ''}`}
                  onClick={() => setSelected(view)}
                  className={cn(
                    'relative aspect-3/4 w-full overflow-hidden rounded-md border-2 bg-[#3b3550]',
                    selected === view ? 'border-primary' : 'border-transparent hover:border-plum/50',
                  )}
                >
                  {state === 'ready' || (view === 'front' && state === 'base') ? (
                    // eslint-disable-next-line @next/next/no-img-element -- our own model picture, served by the API
                    <img src={srcOf(view)} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-white/80">
                      {state === 'drawing' ? <Spinner /> : state === 'failed' ? '!' : null}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 bg-black/45 px-0.5 text-[10px] leading-4 text-white">
                    {DRAPE_VIEW_LABELS[view]}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label="Next view"
            onClick={() => step(1)}
            className="rounded-full p-1 text-plum hover:bg-surface"
          >
            <ChevronDown aria-hidden className="size-5" />
          </button>
        </div>

        <div className="relative aspect-3/4 w-full overflow-hidden rounded-xl bg-[#3b3550]">
          {/* eslint-disable-next-line @next/next/no-img-element -- our own model picture, served by the API */}
          <img
            src={srcOf(shown)}
            alt={drapeId ? `Model wearing ${garments}, ${DRAPE_VIEW_LABELS[shown].toLowerCase()} view` : 'Try-on model'}
            className="size-full object-contain"
          />
          {loading && (
            <p
              role="status"
              className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-surface/90 px-3 py-2 text-sm shadow-sm"
            >
              <Spinner className="text-plum" /> Finding clothes and preparing virtual try-on…
            </p>
          )}
          {!loading && dressing && (
            <p
              role="status"
              className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-surface/90 px-3 py-2 text-sm shadow-sm"
            >
              <Spinner className="text-plum" /> Dressing the model
              {items.length > 1 ? ` in ${items.length} pieces` : ''}… about {15 * items.length} seconds
            </p>
          )}
          {!dressing && selected !== shown && (
            <p
              role="status"
              className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-surface/90 px-3 py-2 text-sm shadow-sm"
            >
              {stateOf(selected) === 'failed' ? (
                `The ${DRAPE_VIEW_LABELS[selected].toLowerCase()} view couldn’t be drawn. Showing the front.`
              ) : (
                <>
                  <Spinner className="text-plum" /> Drawing the {DRAPE_VIEW_LABELS[selected].toLowerCase()} view…
                </>
              )}
            </p>
          )}
        </div>
      </div>
      {dressed?.kind === 'error' && (
        <Alert tone="error">
          {dressed.message || 'We couldn’t dress the model just now.'}{' '}
          <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </Alert>
      )}
      <p className="text-center text-xs text-muted-foreground">{DRAPE_LABEL}</p>
    </div>
  );
}
