import Image from 'next/image';
import Link from 'next/link';
import type { DesignSummary } from '@/lib/discover/design-summary';

/**
 * "Based on your design" (D-132): the garment the user designed in Outfit Categories, shown above the look
 * request. Its layers are the same drawings as the visual customizer's.
 */
export function DesignSummaryCard({ design }: { design: DesignSummary }) {
  return (
    <section
      aria-labelledby="design-summary-heading"
      className="flex flex-col gap-4 rounded-2xl border border-accent bg-surface p-4 sm:flex-row sm:items-center"
    >
      {design.layers.length > 0 && (
        <div
          className="relative aspect-[200/240] w-24 shrink-0 rounded-xl bg-[#fbf6ec]"
          aria-label={`Your design: ${design.garmentName}`}
          role="img"
        >
          {design.layers.map((layer) => (
            <Image key={layer.assetId} src={layer.url} alt="" fill unoptimized className="object-contain" />
          ))}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-plum">Based on your design</p>
        <h2 id="design-summary-heading" className="font-display text-xl text-primary">
          {design.garmentName} · {design.outfitLabel}
        </h2>
        <ul aria-label="Your chosen features" className="flex flex-wrap gap-1.5">
          {design.features.map((name) => (
            <li key={name} className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs text-foreground">
              {name}
            </li>
          ))}
        </ul>
        <Link
          href={`/categories/design/${design.garmentType}?outfit=${design.outfitCategory}`}
          className="inline-flex min-h-11 items-center text-sm text-plum underline"
        >
          Edit design
        </Link>
      </div>
    </section>
  );
}
