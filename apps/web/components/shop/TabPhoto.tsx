'use client';

import { useState } from 'react';
import type { BodyType, Look } from '@styleme/contracts';
import { FigureSvg } from './BodyTypeFigure';

/**
 * The outfit's photo on its Shop My Look tab (#118): the look's stored AI outfit image (#110) through our
 * own route handler, loaded lazily. When outfit images are off or the image fails, the tab shows the look on
 * the illustrated figure (D-119, #120) shaped by the user's body type, in the look's colours: never a stock or
 * made-up photo.
 */
export function TabPhoto({
  look,
  title,
  department = null,
  bodyType = null,
}: {
  look: Look;
  title: string;
  department?: 'women' | 'men' | null;
  bodyType?: BodyType | null;
}) {
  const [failed, setFailed] = useState(false);

  if (!look.image || failed) {
    return (
      <div
        className="flex aspect-[4/5] w-full justify-center overflow-hidden rounded-xl border border-border bg-surface-muted p-1.5"
        data-testid="tab-photo-fallback"
      >
        <FigureSvg look={look} department={department} bodyType={bodyType} className="h-full w-auto" />
      </div>
    );
  }
  return (
    <div className="aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-surface-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- private image from our own route handler */}
      <img
        src={`/api/outfits/${look.id}/image`}
        alt={`AI-generated picture of the outfit: ${title}`}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
