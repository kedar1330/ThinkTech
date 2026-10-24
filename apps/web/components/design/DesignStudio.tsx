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
import {
  resetDesignAction,
  saveDesignAction,
  saveStylingGoalsAction,
  setFeaturePreferenceAction,
} from '@/app/actions/design';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  BlouseBackMannequin,
  FeatureThumbnailSvg,
  LehengaEnsembleMannequin,
  LowerBodyMannequin,
  UpperBodyOverlay,
} from './DesignVisualAssets';

// Outfit Categories → design features (D-132), laid out like the founder's mock-up: (1) illustrated neckline
// cards, (2) a compact sleeve grid, (3) visual dummy cards for trouser cuts, waist rises, collars, drape styles,
// (4) filter tags for surface and fabric, (5) upper and lower body visual customer try-on mannequins.

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
  const [blouseView, setBlouseView] = useState<'front' | 'back'>('front');
  const router = useRouter();

  const isBottom = data.garmentType.kind === 'bottom';
  const isSkirt = data.garmentType.id === 'skirt';
  const isBlouse = data.garmentType.id === 'saree_blouse' || data.garmentType.id === 'blouse';
  const isDrape = data.garmentType.kind === 'drape';
  const isLehenga = data.garmentType.id === 'lehenga';
  const [lehengaView, setLehengaView] = useState<'ensemble' | 'choli' | 'skirt'>('ensemble');

  const byId = useMemo(() => {
    const map = new Map<string, DesignFeatureItem>();
    for (const c of data.categories) for (const f of c.features) map.set(f.featureId, f);
    return map;
  }, [data.categories]);
  const category = (id: DesignFeatureCategory) => data.categories.find((c) => c.id === id);
  const necklines = category('neckline');
  const sleeves = category('sleeve');

  // For Blouse: cleanly split front necklines and back neck designs
  const blouseFrontNecklines = useMemo(() => {
    if (!necklines) return undefined;
    const features = necklines.features.filter(
      (f) =>
        !f.featureId.includes('back') &&
        !f.featureId.includes('backless') &&
        !f.featureId.includes('keyhole') &&
        !f.featureId.includes('sheer_illusion'),
    );
    return { ...necklines, label: 'Front Necklines', features };
  }, [necklines]);

  const blouseBackNecklines = useMemo(() => {
    if (!necklines) return undefined;
    const features = necklines.features.filter(
      (f) =>
        f.featureId.includes('back') ||
        f.featureId.includes('backless') ||
        f.featureId.includes('keyhole') ||
        f.featureId.includes('sheer_illusion'),
    );
    return {
      id: 'neckline' as DesignFeatureCategory,
      label: 'Back Neck Designs',
      features,
      presentation: 'grid' as const,
      sortOrder: 2,
      personalised: necklines.personalised ?? false,
    };
  }, [necklines]);

  /** Primary visual cards categories based on garment anatomy */
  const primaryPanels = useMemo(() => {
    const list: Array<{ title: string; categoryResult: DesignFeatureCategoryResult; compact: boolean }> = [];

    if (isLehenga) {
      // Indian Multi-Piece Ensemble Anatomy: Choli + Lehenga Skirt + Dupatta
      if (necklines && necklines.features.length > 0)
        list.push({ title: 'Choli / Blouse: Necklines & Bodice', categoryResult: necklines, compact: false });
      if (sleeves && sleeves.features.length > 0)
        list.push({ title: 'Choli / Blouse: Sleeves', categoryResult: sleeves, compact: true });
      const fit = category('fit');
      const silhouette = category('silhouette');
      const skirtCategory = fit && fit.features.length > 0 ? fit : silhouette;
      if (skirtCategory && skirtCategory.features.length > 0)
        list.push({ title: 'Lehenga / Skirt: Fit & Silhouette', categoryResult: skirtCategory, compact: false });
      const waistline = category('waistline');
      const waistband = category('waistband');
      const waistCategory = waistline && waistline.features.length > 0 ? waistline : waistband;
      if (waistCategory && waistCategory.features.length > 0)
        list.push({ title: 'Lehenga / Skirt: Waist & Closure', categoryResult: waistCategory, compact: true });
      const draping = category('draping');
      if (draping && draping.features.length > 0)
        list.push({ title: 'Dupatta: Style & Drape', categoryResult: draping, compact: false });
    } else if (isBottom) {
      if (isSkirt) {
        const fit = category('fit');
        if (fit && fit.features.length > 0)
          list.push({ title: 'Skirt Silhouette & Flare', categoryResult: fit, compact: false });
        const waistline = category('waistline');
        const waistband = category('waistband');
        const waistCategory = waistline && waistline.features.length > 0 ? waistline : waistband;
        if (waistCategory && waistCategory.features.length > 0)
          list.push({ title: 'Waist Rise & Waistband', categoryResult: waistCategory, compact: true });
        const length = category('length');
        if (length && length.features.length > 0)
          list.push({ title: 'Skirt Length', categoryResult: length, compact: true });
        const pleats = category('pleats');
        if (pleats && pleats.features.length > 0)
          list.push({ title: 'Pleats & Gathers', categoryResult: pleats, compact: true });
      } else {
        const legShape = category('leg_shape');
        if (legShape && legShape.features.length > 0)
          list.push({ title: 'Trouser Types & Leg Cuts', categoryResult: legShape, compact: false });
        const waistline = category('waistline');
        if (waistline && waistline.features.length > 0)
          list.push({ title: 'Waist Rise & Waistband', categoryResult: waistline, compact: true });
        const fit = category('fit');
        if (fit && fit.features.length > 0)
          list.push({ title: 'Fit & Silhouette', categoryResult: fit, compact: true });
        const length = category('length');
        if (length && length.features.length > 0)
          list.push({ title: 'Length', categoryResult: length, compact: true });
        const pleats = category('pleats');
        if (pleats && pleats.features.length > 0)
          list.push({ title: 'Pleats & Creases', categoryResult: pleats, compact: true });
      }
    } else if (isBlouse) {
      if (blouseFrontNecklines && blouseFrontNecklines.features.length > 0)
        list.push({ title: 'Front Necklines & Bodice', categoryResult: blouseFrontNecklines, compact: false });
      if (blouseBackNecklines && blouseBackNecklines.features.length > 0)
        list.push({ title: 'Back Neck Designs', categoryResult: blouseBackNecklines, compact: false });
      if (sleeves && sleeves.features.length > 0)
        list.push({ title: sleeves.label, categoryResult: sleeves, compact: true });
      const fit = category('fit');
      if (fit && fit.features.length > 0)
        list.push({ title: 'Fit & Bodice', categoryResult: fit, compact: true });
    } else if (isDrape) {
      const draping = category('draping');
      if (draping && draping.features.length > 0)
        list.push({ title: 'Draping Styles', categoryResult: draping, compact: false });
    } else {
      if (necklines && necklines.features.length > 0)
        list.push({ title: necklines.label, categoryResult: necklines, compact: false });
      if (sleeves && sleeves.features.length > 0)
        list.push({ title: sleeves.label, categoryResult: sleeves, compact: true });
      const fit = category('fit');
      if (fit && fit.features.length > 0)
        list.push({ title: 'Fit & Silhouette', categoryResult: fit, compact: true });
    }

    return list;
  }, [
    isLehenga,
    isBottom,
    isSkirt,
    isBlouse,
    isDrape,
    data.categories,
    necklines,
    sleeves,
    blouseFrontNecklines,
    blouseBackNecklines,
  ]);

  const renderedCategoryIds = new Set(primaryPanels.map((p) => p.categoryResult.id));
  if (isBlouse) renderedCategoryIds.add('neckline');
  // Necklines already include collars ("Necklines and collars"). Exclude collar from filter tags.
  renderedCategoryIds.add('collar');
  const activeTagCategories = data.categories.filter((c) => !renderedCategoryIds.has(c.id));

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

  const toggleGoal = (goalId: string) => {
    const nextGoals = goals.includes(goalId) ? goals.filter((x) => x !== goalId) : [...goals, goalId];
    setGoals(nextGoals);
    startTransition(async () => {
      const res = await saveStylingGoalsAction(nextGoals);
      if (res?.error) setMessage({ error: res.error });
    });
  };

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
              'absolute right-2 top-2 flex size-5 items-center justify-center rounded border z-10',
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
            <FeatureThumbnailSvg
              feature={feature}
              compact={compact}
              isBottom={isBottom}
              isLehenga={isLehenga}
              isSkirt={isSkirt}
            />
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
          compact ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3',
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
      {/* What would you like your outfit to do? (Styling Goals) */}
      <section aria-label="Styling goals" className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <h2 className="font-display text-lg text-primary">What would you like your outfit to do?</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Saved directly to your preferences. Styling goals prioritize the cuts and silhouettes recommended for you in
          Discover My Style.
        </p>
        <ul className="flex flex-wrap gap-2">
          {STYLING_GOALS.map((g) => {
            const on = goals.includes(g.id);
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleGoal(g.id)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    on
                      ? 'border-accent bg-accent/20 text-foreground shadow-sm'
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

      {/* Main Studio 3-Column / Adaptive Layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_320px]">
        {/* Column 1: Primary Feature Dummy Cards */}
        <div className="space-y-6">
          {primaryPanels.map((panel, idx) => (
            <Panel key={panel.title} step={idx + 1} title={panel.title}>
              {cardGrid(panel.categoryResult, panel.compact)}
            </Panel>
          ))}
        </div>

        {/* Column 2: Filter Tags & Secondary Choices */}
        <Panel step={primaryPanels.length + 1} title="Filter tags" className="self-start">
          <div className="space-y-5">
            {activeTagCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground">All primary styling choices are displayed on the left.</p>
            ) : (
              activeTagCategories.map((c) => (
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
                                  ? 'border-accent bg-accent text-accent-foreground shadow-sm'
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
              ))
            )}
          </div>
        </Panel>

        {/* Column 3: Visual Customizer (Upper Body or Lower Body try-on mannequin) */}
        <Panel
          step={primaryPanels.length + 2}
          title="Visual customizer"
          className="self-start lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20"
        >
          <div className="mx-auto w-full max-w-[260px]">
            {isLehenga ? (
              // Lehenga Multi-Piece Ensemble (Blouse + Skirt + Dupatta, matching Images 2, 3, 4)
              <div aria-label="Your selected combination">
                <LehengaEnsembleMannequin
                  selected={selected}
                  department={department}
                  view={lehengaView}
                />
              </div>
            ) : isBottom ? (
              // Lower Body Customer Try-On Mannequin (Trousers, Jeans, Palazzo, Skirt)
              <div aria-label="Your selected combination">
                <LowerBodyMannequin
                  selected={selected}
                  department={department}
                  garmentId={data.garmentType.id}
                />
              </div>
            ) : isBlouse && blouseView === 'back' ? (
              // Blouse Back View Mannequin (Backless dori, deep U back, keyhole)
              <div aria-label="Your selected combination">
                <BlouseBackMannequin selected={selected} department={department} />
              </div>
            ) : (
              // Upper Body Customer Mannequin (Tops, Bodices, Kurti, One-Piece Dresses)
              <div
                className="relative aspect-[200/240] w-full rounded-2xl bg-[#faf6ef] border border-[#ecdac7] shadow-inner overflow-hidden"
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

                {/* Dynamic Upper Body Overlay: Fit, Length, Hemline, Closure, Pockets, Patterns */}
                <UpperBodyOverlay selected={selected} department={department} />

                {/* Atelier Sketch Outline Central Status Prompt */}
                {!selected.neckline && !selected.sleeve && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <span className="mb-1 text-2xl font-light leading-none text-[#8a6a42]">+</span>
                    <span className="font-serif text-xs font-medium tracking-wide text-[#7a5a36]">
                      Pick your first piece
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground">Neckline or sleeve</span>
                  </div>
                )}
              </div>
            )}

            {/* Front View / Back View Toggle for Blouses */}
            {isBlouse && (
              <div className="mt-3 flex justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setBlouseView('front')}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    blouseView === 'front'
                      ? 'bg-plum text-white shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  Front View
                </button>
                <button
                  type="button"
                  onClick={() => setBlouseView('back')}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition',
                    blouseView === 'back'
                      ? 'bg-plum text-white shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  Back View
                </button>
              </div>
            )}

            {/* View Toggles for Lehenga Ensemble */}
            {isLehenga && (
              <div className="mt-3 flex justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setLehengaView('ensemble')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition',
                    lehengaView === 'ensemble'
                      ? 'bg-plum text-white shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  Full Ensemble
                </button>
                <button
                  type="button"
                  onClick={() => setLehengaView('choli')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition',
                    lehengaView === 'choli'
                      ? 'bg-plum text-white shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  Choli / Blouse
                </button>
                <button
                  type="button"
                  onClick={() => setLehengaView('skirt')}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition',
                    lehengaView === 'skirt'
                      ? 'bg-plum text-white shadow-sm'
                      : 'border border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  Lehenga Skirt
                </button>
              </div>
            )}

            <p className="mt-2.5 text-center text-xs font-semibold text-foreground">Your selected combo</p>
          </div>

          {chosen.length > 0 ? (
            <ul className="mt-2.5 flex flex-wrap justify-center gap-1.5">
              {chosen.map((f) => (
                <li key={f.featureId} className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-foreground">
                  {f.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              {isLehenga
                ? 'Pick a choli neckline, lehenga flare and draping style.'
                : isBottom
                ? 'Pick a trouser cut, rise, length and fit.'
                : isDrape
                ? 'Pick a drape style and fabric.'
                : 'Pick a neckline, a sleeve and any tags.'}
            </p>
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
            {hasSelection
              ? 'Saves this design, then finds looks that match it.'
              : isLehenga
              ? 'Pick a choli neckline or lehenga silhouette first.'
              : isBottom
              ? 'Pick a trouser cut or waistline first.'
              : isDrape
              ? 'Pick a drape style first.'
              : 'Pick a neckline or sleeve first.'}
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
