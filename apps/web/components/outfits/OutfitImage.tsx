'use client';

import { useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

// The AI outfit image of a look. The first view creates it (it can take up to a minute); a stored one loads
// at once. If it can't be made, the card simply shows the look without an image.

export const OUTFIT_IMAGE_LABEL = 'AI-generated style image — not a product';

export function OutfitImage({ outfitId, ready }: { outfitId: string; ready: boolean }) {
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');
  if (state === 'failed') return null;
  return (
    <figure className="space-y-1.5" data-testid="outfit-image">
      <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl border border-border bg-surface-muted">
        {state === 'loading' && (
          <p
            role="status"
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground"
          >
            <Spinner />
            {ready ? 'Loading your outfit image…' : 'Creating your outfit image… this can take up to a minute.'}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- private image from our own route handler */}
        <img
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
