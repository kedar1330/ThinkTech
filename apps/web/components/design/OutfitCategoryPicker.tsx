'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  CLOTHING_PREFERENCES,
  type DesignTaxonomyResponse,
  type GarmentKind,
  type GarmentTypeItem,
} from '@styleme/contracts';
import { cn } from '@/lib/utils';

// Outfit Categories, step by step (D-132): the Clothing Preference from My Profile decides Women's or Men's
// Wear, the user picks Indian, Western or Indo-Western, then selects from organized garment groups.

interface OutfitCategoryPickerProps {
  taxonomy: DesignTaxonomyResponse;
  outfit: string;
}

type GarmentGroup = 'all' | 'top' | 'one_piece' | 'bottom' | 'drape_layer';

const GROUP_LABELS: Record<GarmentGroup, string> = {
  all: 'All Silhouettes',
  top: 'Tops & Bodices',
  one_piece: 'One-Piece & Sets',
  bottom: 'Bottoms & Trousers',
  drape_layer: 'Drapes & Layers',
};

const KIND_DISPLAY: Record<GarmentKind, { label: string; badge: string }> = {
  top: { label: 'Top / Bodice', badge: 'bg-amber-100/70 text-amber-900 border-amber-200/60' },
  one_piece: { label: 'Full Silhouette', badge: 'bg-emerald-100/70 text-emerald-900 border-emerald-200/60' },
  bottom: { label: 'Bottom Wear', badge: 'bg-sky-100/70 text-sky-900 border-sky-200/60' },
  layer: { label: 'Outerwear / Layer', badge: 'bg-purple-100/70 text-purple-900 border-purple-200/60' },
  drape: { label: 'Drape & Pallu', badge: 'bg-rose-100/70 text-rose-900 border-rose-200/60' },
};

function matchesGroup(g: GarmentTypeItem, group: GarmentGroup): boolean {
  if (group === 'all') return true;
  if (group === 'drape_layer') return g.kind === 'drape' || g.kind === 'layer';
  return g.kind === group;
}

export function OutfitCategoryPicker({ taxonomy, outfit }: OutfitCategoryPickerProps) {
  const department = taxonomy.department ?? 'women';
  const label = CLOTHING_PREFERENCES.find((c) => c.id === department)?.label ?? "Women's Wear";
  const current =
    taxonomy.outfitCategories.find((c) => c.id === outfit) ??
    taxonomy.outfitCategories.find((c) => c.garmentTypes.length > 0) ??
    taxonomy.outfitCategories[0] ??
    null;
  const activeOutfit = current?.id ?? outfit;

  const [activeGroup, setActiveGroup] = useState<GarmentGroup>('all');

  const garments = current?.garmentTypes ?? [];
  const filteredGarments = useMemo(() => {
    return garments.filter((g) => matchesGroup(g, activeGroup));
  }, [garments, activeGroup]);

  // Count per group
  const counts = useMemo(() => {
    const c: Record<GarmentGroup, number> = { all: garments.length, top: 0, one_piece: 0, bottom: 0, drape_layer: 0 };
    for (const g of garments) {
      if (g.kind === 'top') c.top++;
      else if (g.kind === 'one_piece') c.one_piece++;
      else if (g.kind === 'bottom') c.bottom++;
      else if (g.kind === 'drape' || g.kind === 'layer') c.drape_layer++;
    }
    return c;
  }, [garments]);

  const availableGroups = (['all', 'top', 'one_piece', 'bottom', 'drape_layer'] as const).filter(
    (grp) => grp === 'all' || counts[grp] > 0,
  );

  const qs = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(department && taxonomy.canSwitchDepartment ? { department } : {}),
      ...extra,
    });
    return `?${params.toString()}`;
  };

  return (
    <section aria-labelledby="design-steps" className="space-y-6 rounded-2xl border border-border bg-surface p-5 sm:p-7 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-5">
        <div>
          <h2 id="design-steps" className="font-display text-2xl text-primary">
            Design by category
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select a style occasion, then choose a piece to customize features and styling cuts.
          </p>
        </div>
        {taxonomy.canSwitchDepartment ? (
          <div
            role="group"
            aria-label="Clothing Preference"
            className="flex rounded-full border border-border bg-[#faf6ef]/70 p-0.5 text-xs font-medium"
          >
            {CLOTHING_PREFERENCES.map((c) => (
              <Link
                key={c.id}
                href={`/categories?department=${c.id}${outfit ? `&outfit=${outfit}` : ''}`}
                aria-current={department === c.id ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1.5 transition',
                  department === c.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{label}</span> from{' '}
            <Link href="/profile#basics" className="text-plum underline underline-offset-2">
              My Profile
            </Link>
          </p>
        )}
      </div>

      {!department ? (
        <p className="text-sm text-muted-foreground">
          Choose Women’s Wear or Men’s Wear to see garments and design features.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum">Step 1: Choose Wear Category</p>
            <ul className="flex flex-wrap gap-2">
              {taxonomy.outfitCategories.map((c) => {
                const isActive = activeOutfit === c.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={qs({ outfit: c.id })}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition',
                        isActive
                          ? 'border-accent bg-accent text-accent-foreground shadow-sm'
                          : 'border-border bg-surface text-foreground hover:border-accent/60',
                      )}
                    >
                      {isActive && <Sparkles className="size-3.5" />}
                      {c.label}
                      <span className="ml-1 text-[11px] opacity-70">({c.garmentTypes.length})</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {current && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum">
                  Step 2: Choose Your Silhouette
                </p>

                {/* Sub-group tabs to avoid feeling overwhelmed */}
                {availableGroups.length > 2 && (
                  <div className="flex flex-wrap gap-1.5 rounded-xl border border-border bg-[#faf6ef]/70 p-1 text-xs">
                    {availableGroups.map((grp) => (
                      <button
                        key={grp}
                        type="button"
                        onClick={() => setActiveGroup(grp)}
                        className={cn(
                          'rounded-lg px-3 py-1 font-medium transition',
                          activeGroup === grp
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {GROUP_LABELS[grp]} ({counts[grp]})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredGarments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  No garments match this filter in {current.label}.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredGarments.map((g) => {
                    const kindMeta = KIND_DISPLAY[g.kind] ?? { label: g.kind, badge: 'border-border text-foreground' };
                    return (
                      <li key={g.id}>
                        <Link
                          href={`/categories/design/${g.id}${qs({ outfit: current.id })}`}
                          className="group relative flex flex-col justify-between rounded-2xl border border-border bg-[#fbf6ec] p-4 text-left transition hover:border-accent hover:shadow-md hover:ring-1 hover:ring-accent"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide', kindMeta.badge)}>
                                {kindMeta.label}
                              </span>
                              <ArrowRight className="size-3.5 text-muted-foreground/60 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </div>
                            <h3 className="mt-2.5 font-display text-base font-semibold text-foreground group-hover:text-primary">
                              {g.name}
                            </h3>
                          </div>
                          <p className="mt-3 text-[11px] text-muted-foreground">
                            Customize necklines, cuts & drape tailored for you
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
