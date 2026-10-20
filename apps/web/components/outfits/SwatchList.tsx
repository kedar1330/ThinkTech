import type { Swatch } from '@styleme/contracts';
import { cn } from '@/lib/utils';

/** Colour chips, each with its name in text: colour is never the only way a swatch is told apart. */
export function SwatchList({ swatches, className }: { swatches: Swatch[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {swatches.map((s, i) => (
        <li
          key={`${s.colorId}-${i}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
        >
          <span
            aria-hidden
            className="size-3.5 shrink-0 rounded-full border border-foreground/20"
            style={{ backgroundColor: s.hex }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}
