import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ImageOff } from 'lucide-react';
import type { Design } from '@styleme/contracts';
import { DesignActions } from '@/components/design-studio/DesignActions';
import { TailorSheet } from '@/components/design-studio/TailorSheet';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My design' };

/** One design (D-134): the generated picture, the user's sketch, and the tailor spec, printable. */
export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const { accessToken } = await requireOnboarded();
  let design: Design;
  try {
    design = await apiRequest<Design>(`/v1/design-studio/designs/${id}`, { token: accessToken });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // A new URL after every redraw, so the browser fetches the new picture.
  const version = encodeURIComponent(design.updatedAt);

  return (
    <div data-tailor-sheet className="mx-auto max-w-6xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground print:hidden">
        <Link href="/design-studio" className="hover:underline">
          Design Studio
        </Link>{' '}
        / <span className="text-foreground">{design.title}</span>
      </nav>

      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-plum">Design for your tailor</p>
        <h1 className="font-display text-4xl text-primary">{design.title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{design.summary}</p>
      </header>

      <DesignActions designId={design.id} pictureFailed={design.imageStatus === 'failed'} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] print:grid-cols-2">
        <div className="space-y-4">
          <figure className="overflow-hidden rounded-2xl border border-border bg-[#fbf6ec]">
            <div className="relative aspect-[3/4]">
              {design.imageStatus === 'ready' ? (
                <Image
                  src={`/api/design-studio/${design.id}/image?v=${version}`}
                  alt={`Generated design: ${design.title}`}
                  fill
                  unoptimized
                  priority
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                  <ImageOff aria-hidden className="size-8" />
                  The picture couldn’t be drawn this time. Your tailor spec is ready; try the picture again in a minute.
                </div>
              )}
            </div>
            <figcaption className="px-3 py-2 text-[11px] text-muted-foreground">
              AI-generated illustration of the design, not a photo of a real product.
            </figcaption>
          </figure>

          {design.hasSourceImage && (
            <figure className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2">
              <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-white">
                <Image
                  src={`/api/design-studio/${design.id}/image?which=source`}
                  alt="Your original sketch"
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <figcaption className="text-xs text-muted-foreground">Your original sketch</figcaption>
            </figure>
          )}
          {design.description && (
            <div className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-plum">
                {design.source === 'look' ? 'Your changes' : 'Your description'}
              </p>
              <p className="whitespace-pre-line">{design.description}</p>
            </div>
          )}
          {design.lookId && (
            <p className="text-xs text-muted-foreground print:hidden">
              Based on{' '}
              <Link href={`/saved/${design.lookId}`} className="text-plum underline">
                one of your looks
              </Link>
              .
            </p>
          )}
        </div>

        <section aria-label="Tailor specification" className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
          <h2 className="mb-4 font-display text-2xl text-primary">Tailor specification</h2>
          <TailorSheet spec={design.tailorSpec} />
        </section>
      </div>
    </div>
  );
}
