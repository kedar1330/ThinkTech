'use client';

import Link from 'next/link';
import { Palette, Sparkles, Check, ArrowRight, RotateCcw } from 'lucide-react';
import type { ColourPreferencesResponse } from '@styleme/contracts';

// Outfit colours in Discover My Style:
// Decoupled from My Colour Palette likes. Liked colours in My Colour Palette are not automatically
// imported or used as suggestions here. If the user wants specific colours for their outfit, they
// can select them via the separate Colour Palette tab ("from=discover"). If no custom colours are chosen,
// outfits are created using balanced, harmonious colours suited for the garment, occasion, and profile.

export function PaletteColours({
  colours: _colours,
  customColors = [],
  customColorHexes = [],
  garment = null,
}: {
  colours?: ColourPreferencesResponse | null;
  customColors?: string[];
  customColorHexes?: string[];
  garment?: string | null;
}) {
  const hasCustom = customColors.length > 0;
  const paletteUrl = `/palette/colours?from=discover${garment ? `&garment=${encodeURIComponent(garment)}` : ''}`;

  return (
    <section
      aria-labelledby="palette-colours-heading"
      className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xs transition-all"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-plum/10 text-plum">
            <Palette className="size-5" />
          </div>
          <div>
            <h2 id="palette-colours-heading" className="font-display text-xl text-primary">
              {hasCustom ? 'Selected outfit colours' : 'Outfit colours'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {hasCustom
                ? 'Custom colours chosen specifically for this style'
                : 'Balanced harmonious styling, or choose specific colours in Colour Palette'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasCustom ? (
            <>
              <Link
                href={paletteUrl}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-plum/30 bg-plum/5 px-4 text-xs font-semibold text-plum hover:bg-plum/10 transition-colors"
              >
                <Palette className="size-3.5" />
                Change colours in palette
              </Link>
              <Link
                href={`/discover/looks${garment ? `?from=design&garment=${encodeURIComponent(garment)}` : ''}`}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted transition-colors"
              >
                <RotateCcw className="size-3" />
                Reset to all colours
              </Link>
            </>
          ) : (
            <Link
              href={paletteUrl}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-plum px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-plum/90 transition-colors"
            >
              <Sparkles className="size-3.5" />
              Choose specific colours in Colour Palette
              <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      {hasCustom ? (
        <div className="space-y-3 rounded-xl border border-plum/20 bg-plum/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-plum flex items-center gap-1.5">
              <Check className="size-3.5" /> Using chosen colours for this style
            </p>
            <span className="text-xs text-muted-foreground">Custom colour selection active</span>
          </div>
          <ul aria-label="Chosen style colours" className="flex flex-wrap gap-2.5">
            {customColors.map((name, i) => {
              const hex = customColorHexes[i] || (name.startsWith('#') ? name : null);
              return (
                <li
                  key={name}
                  className="inline-flex items-center gap-2 rounded-full border border-plum/30 bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-xs"
                >
                  {hex ? (
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full border border-black/15 shadow-2xs"
                      style={{ backgroundColor: hex }}
                    />
                  ) : (
                    <span className="size-2 rounded-full bg-plum shrink-0" />
                  )}
                  <span>{name}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Outfits will be created strictly around these selected colours.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface-muted/30 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-plum" /> All harmonious colours
            </span>
            <span className="text-xs text-muted-foreground">Separate from palette likes</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Outfits are curated using balanced, harmonious colours suited for your design and occasion. Colours you like
            in <strong className="font-medium text-foreground">My Colour Palette</strong> remain independent and are not
            used as filters here.
          </p>
          <p className="text-xs text-muted-foreground">
            To generate looks around a specific colour, click{' '}
            <strong className="font-medium text-foreground">Choose specific colours in Colour Palette</strong> above.
          </p>
        </div>
      )}
    </section>
  );
}
