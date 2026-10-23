import type { Metadata } from 'next';
import Link from 'next/link';
import { Ban, Heart } from 'lucide-react';
import type { MyColourCombinationsResponse, MyColoursResponse } from '@styleme/contracts';
import { ColourAlbum } from '@/components/colours/ColourAlbum';
import { CombinationGallery } from '@/components/colours/CombinationGallery';
import { CoordinatingColours } from '@/components/colours/CoordinatingColours';
import { MISSING_COLOURS } from '@/components/colours/WhyMyColours';
import { StarterPaletteShowcase } from '@/components/colours/StarterPaletteShowcase';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { STARTER_PALETTE_COLOURS } from '@/lib/palette/starter-palette';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'My colours' };

type View = 'colours' | 'coordinating' | 'combinations';

const VIEWS: Array<{ id: View; label: string; href: string }> = [
  { id: 'colours', label: 'All my colours', href: '/palette/colours' },
  { id: 'coordinating', label: 'Coordinating colours', href: '/palette/colours?view=coordinating' },
  { id: 'combinations', label: 'Combinations', href: '/palette/colours?view=combinations' },
];

/**
 * My colours (D-133): only the 100+ colours suggested for the user's own skin tone and undertone, from My
 * Profile. Other skin tones and undertones are never shown. Colours are selected like photos in an album and
 * saved as liked or to avoid. Coordinating colours and curated combinations (#105) are built only from these
 * colours, without the avoided ones.
 */
export default async function MyColoursPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const view: View = params?.view === 'coordinating' || params?.view === 'combinations' ? params.view : 'colours';
  const { accessToken } = await requireOnboarded();
  const data = await apiRequest<MyColoursResponse>('/v1/colours/mine', { token: accessToken });
  const { category } = data;
  const combos =
    category && view !== 'colours'
      ? await apiRequest<MyColourCombinationsResponse>('/v1/colours/combinations', { token: accessToken })
      : null;
  const missing = MISSING_COLOURS[data.missing ?? combos?.missing ?? 'not_published'];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/palette" className="hover:underline">
          My Colour Palette
        </Link>{' '}
        / <span className="text-foreground">My colours</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-5">
          {category && (
            <span
              aria-hidden
              className="size-16 shrink-0 rounded-full border border-black/10 shadow-sm"
              style={{ backgroundColor: category.skinHex }}
            />
          )}
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">My colours</p>
            <h1 className="font-display text-4xl text-primary">
              {category ? `Colours for ${category.label}` : 'Colours for your skin tone'}
            </h1>
            {category ? (
              <>
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {category.colourCount} colours suggested for your skin tone and undertone from My Profile.{' '}
                  {category.rationale}
                </p>
                <p className="max-w-3xl text-xs text-muted-foreground">{category.limitations}</p>
              </>
            ) : (
              <p className="max-w-2xl text-sm text-muted-foreground">
                The colours suggested for your own skin tone and undertone.
              </p>
            )}
          </div>
        </div>
        <Link
          href="/palette/colours/saved"
          className="inline-flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-sm shadow-xs hover:bg-surface-muted"
        >
          <span className="font-medium">Liked and avoided</span>
          <span className="inline-flex items-center gap-1 text-plum">
            <Heart aria-hidden className="size-4" /> {data.saved.liked}
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Ban aria-hidden className="size-4" /> {data.saved.avoided}
          </span>
          <span className="sr-only">
            ({data.saved.liked} liked, {data.saved.avoided} avoided)
          </span>
        </Link>
      </header>

      {category?.reviewStatus === 'draft' && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-foreground">
          Preview: this list is a draft awaiting founder review and is not published to users yet.
        </p>
      )}

      <nav
        aria-label="My colours views"
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-muted/50 p-1 sm:inline-flex"
      >
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={v.href}
            aria-current={view === v.id ? 'page' : undefined}
            className={cn(
              'rounded-md px-3.5 py-1.5 text-xs font-medium transition-all',
              view === v.id ? 'bg-plum text-white shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {category && view === 'colours' ? (
        <ColourAlbum key={category.categoryId} colours={data.colours} />
      ) : !category && view === 'colours' ? (
        <div className="space-y-6">
          <div className="space-y-3 rounded-xl border border-dashed border-plum/30 bg-plum/5 p-6 text-center">
            <p className="font-display text-xl text-primary">{missing.title}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{missing.body}</p>
            {missing.link && (
              <Link
                href="/profile"
                className="inline-block text-sm font-semibold text-plum underline underline-offset-2"
              >
                Go to My Profile
              </Link>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Explore our versatile starter palette below while you personalize your profile:
            </p>
          </div>
          <StarterPaletteShowcase colours={STARTER_PALETTE_COLOURS} />
        </div>
      ) : category && combos && !combos.missing && view === 'coordinating' ? (
        <CoordinatingColours colours={combos.colours} coordinating={combos.coordinating} />
      ) : category && combos && !combos.missing && view === 'combinations' ? (
        <CombinationGallery combinations={combos.combinations} harmonies={combos.harmonies} />
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="font-display text-xl text-primary">{missing.title}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{missing.body}</p>
          {missing.link && (
            <Link href="/profile" className="inline-block text-sm font-medium text-plum underline underline-offset-2">
              Go to My Profile
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
