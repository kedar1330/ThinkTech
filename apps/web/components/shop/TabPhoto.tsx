'use client';

import { useState } from 'react';
import type { Look } from '@styleme/contracts';
import { garmentSlots } from '@/lib/outfits/look-text';

/**
 * The outfit's photo on its Shop My Look tab (#118): the look's stored AI outfit image (#110) through our
 * own route handler, loaded lazily. When outfit images are off or the image fails, the tab shows the look's
 * garment colours instead, never a stock or made-up photo.
 */
export function TabPhoto({ look, title }: { look: Look; title: string }) {
  const [failed, setFailed] = useState(false);
  const garments = garmentSlots(look);
  const swatches = (garments.length ? garments : look.slots).flatMap((s) => s.swatches.slice(0, 1));

  if (!look.image || failed) {
    return (
      <div
        role="img"
        aria-label={`Colours of this outfit: ${swatches.map((s) => s.name).join(', ')}`}
        className="flex aspect-[4/5] w-full overflow-hidden rounded-xl border border-border"
        data-testid="tab-photo-fallback"
      >
        {swatches.map((s, i) => (
          <span key={`${s.colorId}-${i}`} className="h-full flex-1" style={{ backgroundColor: s.hex }} />
        ))}
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
