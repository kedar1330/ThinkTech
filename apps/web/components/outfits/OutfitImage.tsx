'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

// The AI outfit image of a look. The first view creates it (it can take up to a minute); a stored one loads
// at once. If it can't be made, the card simply shows the look without an image.

export const OUTFIT_IMAGE_LABEL = 'AI-generated style image — not a product';

export function OutfitImage({
  outfitId,
  ready,
  className,
}: {
  outfitId: string;
  ready: boolean;
  /** Sizes the picture's frame where the default (up to 20rem wide) doesn't suit the layout. */
  className?: string;
}) {
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');
  const img = useRef<HTMLImageElement>(null);

  // A cached picture can finish loading before React listens for `load`, which would leave "Loading…" on top
  // of it; check once mounted.
  useEffect(() => {
    const el = img.current;
    if (el?.complete) setState(el.naturalWidth > 0 ? 'shown' : 'failed');
  }, []);

  if (state === 'failed') return null;
  return (
    <figure className="space-y-1.5" data-testid="outfit-image">
      <div
        className={cn(
          'relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border border-border bg-surface-muted',
          className,
        )}
      >
        {state === 'loading' && (
          <p
            role="status"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-muted px-4 text-center text-xs text-muted-foreground"
          >
            <Spinner />
            {ready ? 'Loading your outfit image…' : 'Creating your outfit image… this can take up to a minute.'}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- private image from our own route handler */}
        <img
          ref={img}
          src={`/api/outfits/${outfitId}/image`}
          alt="AI-generated picture of this outfit"
          className="h-full w-full object-cover"
          onLoad={() => setState('shown')}
          onError={() => setState('failed')}
        />
      </div>
      <figcaption className="text-xs text-muted-foreground">{OUTFIT_IMAGE_LABEL}</figcaption>
    </figure>
  );
}
