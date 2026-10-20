import type { Metadata } from 'next';
import type { PaletteListResponse } from '@styleme/contracts';
import { PaletteCard } from '@/components/palette/PaletteCard';
import { ViewToggle } from '@/components/palette/ViewToggle';
import { WhyThesePalettes } from '@/components/palette/WhyThesePalettes';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My Colour Palette' };

/**
 * My Colour Palette (FR-PAL-01 … 03, #40).
 * Browse approved colour palettes with personalised ranking (Recommended for You) or catalog view (Explore All Palettes).
 */
export default async function PalettePage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const view = params?.view === 'all' ? 'all' : 'suggested';
  const { accessToken } = await requireOnboarded();
  const { palettes } = await apiRequest<PaletteListResponse>(`/v1/style/palettes?view=${view}`, {
    token: accessToken,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">My Colour Palette</p>
          <h1 className="font-display text-4xl text-primary">Curated colour palettes</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Browse curated palettes to see which colours work together naturally. Each palette pairs foundation neutrals
            with coordinating accents and tested contrast combinations.
          </p>
        </div>

        {palettes.length > 0 && <ViewToggle currentView={view} />}
      </header>

      {palettes.length === 0 ? (
        <section aria-labelledby="empty-palette-heading">
          <h2 id="empty-palette-heading" className="sr-only">
            No palettes available
          </h2>
          <div className="rounded-xl border border-dashed border-border px-4 py-12 text-center space-y-2">
            <p className="font-display text-xl text-primary">No approved palettes yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No colour palettes have been approved by our styling team yet. Curated palettes will appear here as soon
              as they are published.
            </p>
          </div>
        </section>
      ) : (
        <>
          <WhyThesePalettes palettes={palettes} view={view} />

          <section aria-labelledby="palette-grid-heading" className="space-y-4">
            <h2 id="palette-grid-heading" className="sr-only">
              Curated palettes
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {palettes.map((palette) => (
                <li key={palette.id} className="min-w-0">
                  <PaletteCard palette={palette} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
