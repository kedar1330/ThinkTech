import type { Swatch as SwatchData } from '@styleme/contracts';

/** A colour chip with its name; the name carries the meaning, the chip is decorative. */
export function Swatch({ swatch }: { swatch: SwatchData }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-full border border-border"
        style={{ backgroundColor: swatch.hex }}
      />
      {swatch.name}
    </span>
  );
}
