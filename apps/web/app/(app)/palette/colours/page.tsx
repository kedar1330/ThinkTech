import type { Metadata } from 'next';
import Link from 'next/link';
import { Ban, Heart } from 'lucide-react';
import type { MyColoursMissing, MyColoursResponse } from '@styleme/contracts';
import { ColourAlbum } from '@/components/colours/ColourAlbum';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My colours' };

const MISSING: Record<MyColoursMissing, { title: string; body: string; link: boolean }> = {
  skin_tone: {
    title: 'Add your skin tone to see your colours',
    body: 'Choose your skin tone in My Profile (or add a face photo) and we will show the 100+ colours suggested for your skin tone and undertone.',
    link: true,
  },
  undertone: {
    title: 'Add your undertone to see your colours',
    body: 'Choose warm, cool, neutral or olive in My Profile (or add a face photo) and we will show the colours suggested for it.',
    link: true,
  },
  signals_off: {
    title: 'Your skin tone isn’t being used',
    body: 'You have switched off using your skin tone and undertone. Switch it back on in My Profile to see your colours.',
    link: true,
  },
  not_published: {
    title: 'Your colours aren’t published yet',
    body: 'Our styling team is still reviewing the colours for your skin tone and undertone. They will appear here once approved.',
    link: false,
  },
};

/**
 * My colours (D-133): only the 100+ colours suggested for the user's own skin tone and undertone, from My
 * Profile. Other skin tones and undertones are never shown. Colours are selected like photos in an album and
 * saved as liked or to avoid.
 */
export default async function MyColoursPage() {
  const { accessToken } = await requireOnboarded();
  const data = await apiRequest<MyColoursResponse>('/v1/colours/mine', { token: accessToken });
  const { category } = data;

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

      {category ? (
        <ColourAlbum key={category.categoryId} colours={data.colours} />
      ) : (
        <div className="space-y-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
          <p className="font-display text-xl text-primary">{MISSING[data.missing ?? 'not_published'].title}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {MISSING[data.missing ?? 'not_published'].body}
          </p>
          {MISSING[data.missing ?? 'not_published'].link && (
            <Link href="/profile" className="inline-block text-sm font-medium text-plum underline underline-offset-2">
              Go to My Profile
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
