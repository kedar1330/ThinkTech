'use client';

import { useEffect, useId, useState, useTransition } from 'react';
import Link from 'next/link';
import { Box, Image as ImageIcon, RotateCcw, Trash2 } from 'lucide-react';
import {
  PRICE_RANGE_STORES,
  TRY_ON_3D_LABEL,
  TRY_ON_IMAGE_LABEL,
  TRY_ON_KEEP_HOURS,
  tryOnJobSchema,
  type TryOnItem,
  type TryOnJob,
  type TryOnOutfitItem,
  type TryOnOverview,
} from '@styleme/contracts';
import { deleteTryOnAction, startTryOnAction } from '@/app/actions/try-on';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { formatInr } from '@/lib/shop/format';
import { cn } from '@/lib/utils';
import { ModelViewer } from './ModelViewer';

/** How often the page asks how the try-on is going, and for how long at most. */
const POLL_MS = 3000;
const MAX_POLLS = 400;

const storeName = (id: string) => PRICE_RANGE_STORES.find((s) => s.id === id)?.label ?? id;
const running = (job: TryOnJob) => job.stage === 'try_on' || job.stage === 'model_3d';

/**
 * 3D Virtual Try-On (D-137). The user agrees to the notice, then their stored full-body photo is dressed in the
 * similar item (or the whole look, garment by garment) and turned into a 3D model. The page polls while it
 * runs, then shows the try-on picture and the 360° view. If the try-on fails, the store's own picture of each
 * item is shown with the reason, so the page is never a dead end.
 */
export function TryOnStudio({
  overview,
  outfitId,
  slotId,
  item,
  items,
  subject,
}: {
  overview: TryOnOverview;
  outfitId: string;
  slotId?: string;
  item?: TryOnItem;
  /** The outfit put together on the 3D mannequin, tried on as one. */
  items?: TryOnOutfitItem[];
  /** What is tried on, for the headings: the item's title or the look's. */
  subject: string;
}) {
  const [agreed, setAgreed] = useState(false);
  const [job, setJob] = useState<TryOnJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'picture' | '3d'>('picture');
  const [pending, startTransition] = useTransition();
  const noticeId = useId();

  // Poll while the try-on runs; each poll lets the API move it on.
  useEffect(() => {
    if (!job || !running(job)) return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      polls += 1;
      try {
        const res = await fetch(`/api/try-on/${job.id}`, { cache: 'no-store' });
        const parsed = res.ok ? tryOnJobSchema.safeParse(await res.json()) : null;
        if (cancelled) return;
        if (parsed?.success) {
          setJob(parsed.data);
          if (!running(parsed.data)) return;
        }
      } catch {
        // A dropped poll is retried on the next tick.
      }
      if (cancelled) return;
      if (polls >= MAX_POLLS) {
        setError('This try-on is taking much longer than usual. Please try again later.');
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Restart only for a new try-on; stage changes are handled inside the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startTryOnAction({ outfitId, slotId, item, items, agreed });
      if (res.error || !res.job) setError(res.error ?? 'Something went wrong. Please try again.');
      else {
        setView('picture');
        setJob(res.job);
      }
    });
  }

  function remove() {
    if (!job) return;
    startTransition(async () => {
      const res = await deleteTryOnAction(job.id);
      if (res.error) setError(res.error);
      else {
        setJob(null);
        setAgreed(false);
      }
    });
  }

  if (!overview.available) {
    return <Alert>Virtual Try-On is not available right now. Please try again later.</Alert>;
  }
  if (overview.tryOnModel === 'dummy_model' || !overview.hasPhoto) {
    return (
      <Card className="space-y-3 p-4 sm:p-6">
        <h2 className="font-display text-2xl text-primary">Add your photo to try this on</h2>
        <p className="text-sm text-muted-foreground">
          {overview.hasPhoto
            ? 'You chose the dummy model in My Profile. The realistic AI picture dresses your own photo, so choose “Upload your photo” to try outfits on yourself.'
            : 'The realistic AI picture dresses your own full-body photo. Add one in My Profile → 3D Virtual Try-On, then come back here.'}
        </p>
        <Button asChild size="sm">
          <Link href="/profile#try-on">Go to 3D Virtual Try-On in My Profile</Link>
        </Button>
      </Card>
    );
  }

  if (!job) {
    return (
      <Card className="space-y-4 p-4 sm:p-6">
        <div className="space-y-2 text-sm">
          <h2 className="font-display text-2xl text-primary">Before we try it on</h2>
          <p>
            To try <span className="font-medium">{subject}</span> on you, StyleMe sends your 3D Virtual Try-On photo and
            the store’s picture of the item to our try-on service, fal.ai. It dresses your photo in the item and turns
            the result into a 3D model you can turn around. Nothing else about you is sent.
          </p>
          <p className="text-muted-foreground">
            The picture and 3D model are kept privately in your account for {TRY_ON_KEEP_HOURS} hours, then deleted; you
            can delete them sooner. Deleting your try-on photo deletes them too. The result is AI-generated and may not
            show the exact fit, colour or drape.
          </p>
        </div>
        <Checkbox
          id={noticeId}
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          label="I agree to send my try-on photo and the item’s picture to fal.ai for this try-on."
        />
        {error && <Alert tone="error">{error}</Alert>}
        <Button type="button" disabled={!agreed || pending} onClick={start}>
          {pending ? (
            <>
              <Spinner /> Starting…
            </>
          ) : (
            'Try it on'
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {job.stage === 'try_on' && (
        <Card className="flex items-center gap-3 p-4 text-sm" role="status">
          <Spinner className="size-5 text-plum" />
          <span>
            Dressing your photo
            {job.totalSteps > 1 ? ` — piece ${job.step} of ${job.totalSteps}` : ''}… This usually takes under a minute.
          </span>
        </Card>
      )}

      {job.stage === 'failed' ? (
        <Card className="space-y-4 p-4 sm:p-6">
          <Alert tone="error">{job.message ?? 'We couldn’t finish your try-on. Please try again.'}</Alert>
          <p className="text-sm text-muted-foreground">Here is the store’s own picture of what you picked:</p>
          <Garments job={job} />
          <Button type="button" variant="outline" disabled={pending} onClick={() => setJob(null)}>
            <RotateCcw aria-hidden /> Try again
          </Button>
        </Card>
      ) : (
        job.imageReady && (
          <Card className="space-y-4 p-4 sm:p-6">
            <div role="tablist" aria-label="Try-on view" className="flex gap-2">
              {(
                [
                  ['picture', 'Try-on picture', ImageIcon],
                  ['3d', '360° 3D view', Box],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`tab-${id}`}
                  aria-selected={view === id}
                  aria-controls={`panel-${id}`}
                  onClick={() => setView(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                    view === id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-plum/60',
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </button>
              ))}
            </div>

            {view === 'picture' ? (
              <div role="tabpanel" id="panel-picture" aria-labelledby="tab-picture" className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- the user's own private picture, served no-store */}
                <img
                  src={`/api/try-on/${job.id}/image`}
                  alt={`Your photo wearing ${subject}`}
                  className="mx-auto max-h-[70vh] w-auto rounded-xl object-contain"
                />
                <p className="text-xs text-muted-foreground">{TRY_ON_IMAGE_LABEL}</p>
              </div>
            ) : (
              <div role="tabpanel" id="panel-3d" aria-labelledby="tab-3d" className="space-y-2">
                {job.model3d === 'ready' ? (
                  <ModelViewer src={`/api/try-on/${job.id}/model`} alt={`3D model of you wearing ${subject}`} />
                ) : job.model3d === 'pending' ? (
                  <p role="status" className="flex items-center gap-2 rounded-xl bg-surface-muted p-4 text-sm">
                    <Spinner /> Building your 360° model… This can take a minute or two.
                  </p>
                ) : (
                  <Alert>The 3D model couldn’t be built this time. Your try-on picture is still here.</Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  {TRY_ON_3D_LABEL} Drag to turn it, pinch or scroll to zoom.
                </p>
              </div>
            )}

            <Garments job={job} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={remove}>
                <Trash2 aria-hidden /> Delete this try-on
              </Button>
            </div>
          </Card>
        )
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

/** The items tried on, with the store's picture, price and Google Shopping link. */
function Garments({ job }: { job: TryOnJob }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {job.garments.map((g) => (
        <li key={g.slotId} className="flex flex-col gap-1.5 rounded-xl border border-border p-2 text-xs">
          {g.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- the store's Google-hosted thumbnail, as the search returned it
            <img
              src={g.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-square w-full rounded-lg bg-surface-muted object-contain"
            />
          )}
          <span className="line-clamp-2">{g.title}</span>
          <span>
            <span className="font-medium">{formatInr(g.price)}</span>{' '}
            <span className="text-muted-foreground">· {storeName(g.store)}</span>
          </span>
          {g.link && (
            <a
              href={g.link}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-plum underline underline-offset-2"
            >
              View on Google Shopping
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
