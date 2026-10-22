'use client';

import { useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, EyeOff, Heart, RotateCcw, Sparkles } from 'lucide-react';
import {
  STYLING_GOALS,
  type DesignFeatureCategory,
  type DesignFeatureCategoryResult,
  type DesignFeatureItem,
  type DesignFeaturesResponse,
  type OutfitCategory,
  type SelectedFeatures,
} from '@styleme/contracts';
import { resetDesignAction, saveDesignAction, setFeaturePreferenceAction } from '@/app/actions/design';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Outfit Categories → design features (D-132), laid out like the founder's mock-up: (1) illustrated neckline
// cards, (2) a compact sleeve grid, (3) filter tags for every other category, (4) the visual customizer that
// stacks the chosen neckline and sleeve on the dress form. Choices stay in the browser until Save Preferences.

interface DesignStudioProps {
  data: DesignFeaturesResponse;
  outfitCategory: OutfitCategory;
  stylingGoals: string[];
  /** Sent with saves when the profile allows both Women's and Men's Wear. */
  department?: 'women' | 'men';
}

const RESULT_LABEL = { recommended: 'Suits you', alternative: 'Also works', not_preferred: 'Less preferred' } as const;

function SuitabilityBadge({ feature }: { feature: DesignFeatureItem }) {
  if (feature.preference === 'liked' && !feature.suitability)
    return <span className="rounded-full bg-plum/10 px-2 py-0.5 text-[11px] text-plum">You liked this</span>;
  if (!feature.suitability) return null;
  const { result } = feature.suitability;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px]',
        result === 'recommended' && 'bg-accent/20 text-foreground',
        result === 'alternative' && 'bg-surface-muted text-muted-foreground',
        result === 'not_preferred' && 'bg-error-soft text-foreground',
      )}
    >
      {RESULT_LABEL[result]}
    </span>
  );
}

function PreferenceButtons({ feature, onChange }: { feature: DesignFeatureItem; onChange: (p: string) => void }) {
  const liked = feature.preference === 'liked';
  const hidden = feature.preference === 'disliked';
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(liked ? 'no_preference' : 'liked')}
        aria-pressed={liked}
        aria-label={liked ? `Unlike ${feature.name}` : `Like ${feature.name}`}
        title={liked ? 'Liked: always shown' : 'Like: always show this'}
        className="rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-plum"
      >
        <Heart className={cn('size-3.5', liked && 'fill-plum text-plum')} />
      </button>
      <button
        type="button"
        onClick={() => onChange(hidden ? 'no_preference' : 'disliked')}
        aria-pressed={hidden}
        aria-label={hidden ? `Show ${feature.name} again` : `Hide ${feature.name}`}
        title={hidden ? 'Hidden: click to show again' : 'Not for me: hide this'}
        className="rounded-full p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <EyeOff className={cn('size-3.5', hidden && 'text-foreground')} />
      </button>
    </div>
  );
}

function Panel({
  title,
  step,
  children,
  className,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-surface p-4 sm:p-5', className)} aria-label={title}>
      <h2 className="mb-4 font-display text-xl text-primary">
        <span className="text-plum">{step}.</span> {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyCategory({ label }: { label: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
      No {label.toLowerCase()} match your profile for this garment. Switch to “Show all” to see every option.
    </p>
  );
}

export function DesignStudio({ data, outfitCategory, stylingGoals, department }: DesignStudioProps) {
  const [selected, setSelected] = useState<SelectedFeatures>(data.selection?.selectedFeatures ?? {});
  const [goals, setGoals] = useState<string[]>(stylingGoals);
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const byId = useMemo(() => {
    const map = new Map<string, DesignFeatureItem>();
    for (const c of data.categories) for (const f of c.features) map.set(f.featureId, f);
    return map;
  }, [data.categories]);
  const category = (id: DesignFeatureCategory) => data.categories.find((c) => c.id === id);
  const necklines = category('neckline');
  const sleeves = category('sleeve');
  const tagCategories = data.categories.filter((c) => c.presentation === 'tags');

  /** Why a feature cannot be picked with the current choices, if it can't. */
  const blockedBy = (feature: DesignFeatureItem): string | null => {
    for (const [a, b] of data.incompatible) {
      const other = a === feature.featureId ? b : b === feature.featureId ? a : null;
      if (other && Object.values(selected).includes(other)) return byId.get(other)?.name ?? 'your current choice';
    }
    return null;
  };

  const toggle = (feature: DesignFeatureItem) => {
    if (blockedBy(feature)) return;
    setMessage(null);
    setSelected((current) => {
      const next = { ...current };
      if (next[feature.category] === feature.featureId) delete next[feature.category];
      else next[feature.category] = feature.featureId;
      return next;
    });
  };

  const setPreference = (feature: DesignFeatureItem, preference: string) =>
    startTransition(async () => {
      const result = await setFeaturePreferenceAction(feature.featureId, preference);
      if (result?.error) setMessage({ error: result.error });
    });

  const saveSelection = () =>
    saveDesignAction({
      selection: {
        garmentType: data.garmentType.id,
        outfitCategory,
        ...(department ? { department } : {}),
        selectedFeatures: selected,
        customization: {},
      },
      stylingGoals: goals,
    });

  const save = () =>
    startTransition(async () => {
      const result = await saveSelection();
      setMessage(result?.error ? { error: result.error } : { success: result?.success ?? 'Saved.' });
    });

  /** Saves first, so Discover My Style always builds looks around the design shown here. */
  const discover = () =>
    startTransition(async () => {
      const result = await saveSelection();
      if (result?.error) {
        setMessage({ error: result.error });
        return;
      }
      const query = new URLSearchParams({ from: 'design', garment: data.garmentType.id, outfit: outfitCategory });
      router.push(`/discover/looks?${query.toString()}`);
    });
  const hasSelection = Object.keys(selected).length > 0;

  const reset = () =>
    startTransition(async () => {
      setSelected({});
      const result = await resetDesignAction(data.garmentType.id, department);
      setMessage(result?.error ? { error: result.error } : { success: result?.success ?? 'Cleared.' });
    });

  const card = (feature: DesignFeatureItem, compact: boolean) => {
    const isSelected = selected[feature.category] === feature.featureId;
    const blocked = blockedBy(feature);
    const reason = feature.suitability?.reasons[0] ?? feature.description;
    return (
      <li key={feature.featureId} className="flex flex-col">
        <button
          type="button"
          onClick={() => toggle(feature)}
          aria-pressed={isSelected}
          aria-label={feature.name}
          aria-describedby={`${feature.featureId}-why`}
          disabled={blocked !== null}
          title={blocked ? `Can’t be made with ${blocked}` : reason}
          className={cn(
            'relative flex flex-1 flex-col items-center rounded-xl border bg-[#fbf6ec] p-2 text-left transition',
            isSelected ? 'border-accent ring-2 ring-accent' : 'border-border hover:border-accent/60',
            blocked && 'cursor-not-allowed opacity-40',
            feature.preference === 'disliked' && 'opacity-50',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'absolute right-2 top-2 flex size-5 items-center justify-center rounded border',
              isSelected ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface',
            )}
          >
            {isSelected && <Check className="size-3.5" />}
          </span>
          {feature.image ? (
            <Image
              src={feature.image.url}
              alt={feature.image.alt}
              width={200}
              height={240}
              unoptimized
              className={cn('w-auto', compact ? 'h-24' : 'h-36 sm:h-40')}
            />
          ) : (
            <span className={cn('flex items-center text-xs text-muted-foreground', compact ? 'h-24' : 'h-36')}>
              No picture yet
            </span>
          )}
          <span className="mt-1 w-full text-center text-sm font-medium text-foreground">{feature.name}</span>
          <span
            id={`${feature.featureId}-why`}
            className={cn('line-clamp-2 w-full text-center text-[11px] text-muted-foreground', compact && 'sr-only')}
          >
            {blocked ? `Can’t be made with ${blocked}.` : reason}
          </span>
        </button>
        <div className="mt-1 flex items-center justify-between gap-1 px-1">
          <SuitabilityBadge feature={feature} />
          <PreferenceButtons feature={feature} onChange={(p) => setPreference(feature, p)} />
        </div>
      </li>
    );
  };

  const cardGrid = (c: DesignFeatureCategoryResult | undefined, compact: boolean) =>
    !c ? null : c.features.length === 0 ? (
      <EmptyCategory label={c.label} />
    ) : (
      <ul
        className={cn(
          'grid gap-3',
          compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
        )}
      >
        {c.features.map((f) => card(f, compact))}
      </ul>
    );

  const necklineLayer = selected.neckline ? byId.get(selected.neckline)?.layer : null;
  const sleeveLayer = selected.sleeve ? byId.get(selected.sleeve)?.layer : null;
  const chosen = Object.values(selected)
    .map((id) => byId.get(id))
    .filter((f): f is DesignFeatureItem => Boolean(f));

  return (
    <div className="space-y-6">
      <section aria-label="Styling goals" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="font-display text-lg text-primary">What would you like your outfit to do?</h2>
        <p className="mb-3 text-xs text-muted-foreground">Optional. Goals change what is suggested once you save.</p>
        <ul className="flex flex-wrap gap-2">
          {STYLING_GOALS.map((g) => {
            const on = goals.includes(g.id);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGoals((list) => (on ? list.filter((x) => x !== g.id) : [...list, g.id]))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition',
                    on
                      ? 'border-accent bg-accent/20 text-foreground'
                      : 'border-border text-muted-foreground hover:border-accent/60',
                  )}
                >
                  {g.label}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_280px]">
        <div className="space-y-6">
          {necklines && (
            <Panel step={1} title={necklines.label}>
              {cardGrid(necklines, false)}
            </Panel>
          )}
          {sleeves && (
            <Panel step={2} title={sleeves.label}>
              {cardGrid(sleeves, true)}
            </Panel>
          )}
        </div>

        <Panel step={necklines ? 3 : 1} title="Filter tags" className="self-start">
          <div className="space-y-5">
            {tagCategories.map((c) => (
              <div key={c.id}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-plum">{c.label}</h3>
                {c.features.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing matches your profile here.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {c.features.map((f) => {
                      const on = selected[f.category] === f.featureId;
                      const blocked = blockedBy(f);
                      return (
                        <li key={f.featureId}>
                          <button
                            type="button"
                            aria-pressed={on}
                            disabled={blocked !== null}
                            onClick={() => toggle(f)}
                            title={f.suitability?.reasons[0] ?? f.description}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition',
                              on
                                ? 'border-accent bg-accent text-accent-foreground'
                                : 'border-border bg-[#fbf6ec] text-foreground hover:border-accent/60',
                              f.suitability?.result === 'recommended' && !on && 'border-accent/70',
                              blocked && 'opacity-40',
                            )}
                          >
                            {on && <Check className="size-3" />}
                            {f.name}
                            {f.suitability?.result === 'recommended' && <span className="sr-only"> (suits you)</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          step={necklines ? 4 : 2}
          title="Visual customizer"
          className="self-start lg:col-span-2 xl:sticky xl:top-20 xl:col-span-1"
        >
          <div className="mx-auto w-full max-w-[240px]">
            <div
              className="relative aspect-[200/240] w-full rounded-xl bg-[#fbf6ec]"
              aria-label="Your selected combination"
            >
              {data.baseFigure && (
                <Image
                  src={data.baseFigure.url}
                  alt={data.baseFigure.alt}
                  fill
                  unoptimized
                  className="object-contain"
                />
              )}
              {necklineLayer && (
                <Image src={necklineLayer.url} alt={necklineLayer.alt} fill unoptimized className="object-contain" />
              )}
              {sleeveLayer && (
                <Image src={sleeveLayer.url} alt={sleeveLayer.alt} fill unoptimized className="object-contain" />
              )}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Your selected combo</p>
          </div>
          {chosen.length > 0 ? (
            <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
              {chosen.map((f) => (
                <li key={f.featureId} className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-foreground">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-center text-xs text-muted-foreground">Pick a neckline, a sleeve and any tags.</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="accent" size="sm" className="flex-1" onClick={save} disabled={pending}>
              Save preferences
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reset} disabled={pending} aria-label="Reset">
              <RotateCcw /> Reset
            </Button>
          </div>
          <Button
            type="button"
            size="full"
            className="mt-2"
            onClick={discover}
            disabled={pending || !hasSelection}
            aria-describedby="discover-hint"
          >
            <Sparkles aria-hidden /> Discover my style <ArrowRight aria-hidden />
          </Button>
          <p id="discover-hint" className="mt-1 text-center text-[11px] text-muted-foreground">
            {hasSelection ? 'Saves this design, then finds looks that match it.' : 'Pick a neckline or sleeve first.'}
          </p>
          <p
            role="status"
            className={cn('mt-2 min-h-5 text-center text-xs', message?.error ? 'text-destructive' : 'text-success')}
          >
            {message?.error ?? message?.success ?? ''}
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            Change Women’s or Men’s Wear in{' '}
            <Link href="/profile#basics" className="underline">
              My Profile
            </Link>
            .
          </p>
        </Panel>
      </div>
    </div>
  );
}
