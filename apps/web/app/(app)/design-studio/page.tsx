import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ImageOff } from 'lucide-react';
import type { DesignStudioResponse, OutfitDetail } from '@styleme/contracts';
import { DesignStudioForm, type LookToChange } from '@/components/design-studio/DesignStudioForm';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { categoryLabel, specHints } from '@/lib/discover/look-spec';

export const metadata: Metadata = { title: 'Design Studio' };

const SOURCE_LABEL = { sketch: 'Drawn', upload: 'Uploaded', description: 'Described', look: 'From a look' } as const;

/**
 * Design Studio (D-134): draw, upload or describe an idea, or change a look from Discover My Style
 * (`?look=<id>`), and get a picture plus a tailor spec to take to a tailor.
 */
export default async function DesignStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ look?: string; deleted?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  const { accessToken } = await requireOnboarded();
  const studio = await apiRequest<DesignStudioResponse>('/v1/design-studio', { token: accessToken });

  let look: LookToChange | undefined;
  let lookMissing = false;
  if (query.look && /^[a-f0-9]{24}$/.test(query.look)) {
    try {
      const detail = await apiRequest<OutfitDetail>(`/v1/outfits/${query.look}`, { token: accessToken });
      look = {
        id: detail.id,
        pieces: detail.slots.map((s) => ({
          slotId: s.slotId,
          label: categoryLabel(s.lookSpec),
          details: specHints(s.lookSpec).join(' · '),
          swatches: s.swatches.map((w) => ({ name: w.name, hex: w.hex })),
        })),
      };
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
      lookMissing = true;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-plum">Design Studio</p>
        <h1 className="font-display text-4xl text-primary">
          {look ? 'Change this look your way' : 'Design an outfit for your tailor'}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {look
            ? 'Tell us what to change, such as the sleeves or the neckline. We keep the rest of the look, draw the new design and write a spec your tailor can work from.'
            : 'Draw it, upload a sketch, or describe it in words. We draw the finished design and write a spec your tailor can work from: fabric, an estimate of how much to buy, and cutting and stitching notes.'}
        </p>
      </header>

      {query.deleted && (
        <p role="status" className="rounded-xl bg-success-soft px-4 py-3 text-sm">
          Design deleted.
        </p>
      )}
      {lookMissing && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm">
          That look is no longer available (suggested looks expire unless you save them). Describe your idea below, or{' '}
          <Link href="/discover/looks" className="text-plum underline">
            find new looks
          </Link>
          .
        </p>
      )}

      {studio.available ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {!studio.imagesAvailable && (
              <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm">
                Pictures can’t be drawn right now, so new designs come with the tailor spec only.
              </p>
            )}
            {look && (
              <p className="text-sm">
                <Link href="/design-studio" className="text-plum underline">
                  Start from scratch instead
                </Link>
              </p>
            )}
            <DesignStudioForm key={look?.id ?? 'new'} look={look} />
          </div>
          <MyDesigns designs={studio.designs} limit={studio.limit} />
        </div>
      ) : (
        <div className="space-y-6">
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm">
            Design Studio is not available right now. Please check back soon.
          </p>
          <MyDesigns designs={studio.designs} limit={studio.limit} />
        </div>
      )}
    </div>
  );
}

function MyDesigns({ designs, limit }: { designs: DesignStudioResponse['designs']; limit: number }) {
  return (
    <section aria-label="My designs" className="space-y-3">
      <h2 className="font-display text-2xl text-primary">My designs</h2>
      {designs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Your designs will appear here.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {designs.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/design-studio/${d.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-surface hover:border-accent/60"
                >
                  <div className="relative aspect-[3/4] bg-[#fbf6ec]">
                    {d.imageStatus === 'ready' ? (
                      <Image
                        src={`/api/design-studio/${d.id}/image`}
                        alt=""
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-muted-foreground">
                        <ImageOff aria-hidden className="size-6" />
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-1 text-sm font-medium">{d.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {SOURCE_LABEL[d.source]} · {new Date(d.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {designs.length} of {limit} designs.
          </p>
        </>
      )}
    </section>
  );
}
