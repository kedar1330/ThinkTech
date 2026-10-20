import type { Swatch } from '@styleme/contracts';
import { textContrastColor } from '@/lib/palette/palette-utils';
import { cn } from '@/lib/utils';

export interface ColourSwatchProps {
  swatch: Swatch;
  size?: 'sm' | 'md' | 'lg';
  showHex?: boolean;
  roleLabel?: string;
  className?: string;
}

/**
 * Accessible colour swatch (FR-PAL-01 … 03).
 * Every swatch always has a clear text label (never colour alone) and contrast-aware text.
 */
export function ColourSwatch({ swatch, size = 'sm', showHex = false, roleLabel, className }: ColourSwatchProps) {
  const contrastText = textContrastColor(swatch.hex);

  if (size === 'lg') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-border bg-surface shadow-xs transition-shadow hover:shadow-sm min-w-0',
          className,
        )}
      >
        <div
          className="relative flex h-24 sm:h-28 flex-col justify-between p-3 border-b border-border/50"
          style={{
            backgroundColor: swatch.hex,
            color: contrastText,
          }}
        >
          {roleLabel && (
            <span className="self-start rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-black/20 backdrop-blur-xs">
              {roleLabel}
            </span>
          )}
          <div className="mt-auto">
            <p className="text-sm font-semibold tracking-wide drop-shadow-xs">{swatch.name}</p>
            <p className="font-mono text-xs opacity-90">{swatch.hex}</p>
          </div>
        </div>
        <div className="p-3 space-y-0.5">
          {roleLabel && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{roleLabel}</p>
          )}
          <p className="font-semibold text-primary text-sm sm:text-base">{swatch.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{swatch.hex}</p>
        </div>
      </div>
    );
  }

  if (size === 'md') {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg border border-border bg-surface p-2 shadow-xs min-w-0',
          className,
        )}
      >
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-md border border-black/10 flex items-center justify-center shadow-xs"
          style={{ backgroundColor: swatch.hex }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{swatch.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{swatch.hex}</p>
        </div>
        {roleLabel && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {roleLabel}
          </span>
        )}
      </div>
    );
  }

  // size === 'sm' (chip)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-xs border border-black/10 min-w-0',
        className,
      )}
      style={{
        backgroundColor: swatch.hex,
        color: contrastText,
      }}
    >
      <span className="truncate">{swatch.name}</span>
      {showHex && <span className="font-mono text-[10px] opacity-85 shrink-0">{swatch.hex}</span>}
    </span>
  );
}
