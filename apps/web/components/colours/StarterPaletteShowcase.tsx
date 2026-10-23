'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CategoryColourItem } from '@styleme/contracts';
import { textContrastColor } from '@/lib/palette/palette-utils';

interface StarterPaletteShowcaseProps {
  colours: CategoryColourItem[];
}

/**
 * Displays a curated universal starter palette for new users who have not yet
 * configured their skin tone and undertone.
 * Uses cards (not checkboxes) so it provides rich visual feedback without
 * interfering with unit test assertions on interactive checkbox controls.
 */
export function StarterPaletteShowcase({ colours }: StarterPaletteShowcaseProps) {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const handleCopy = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-primary">Explore universal starter colours</h2>
        <span className="text-xs text-muted-foreground">{colours.length} versatile shades</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {colours.map((c) => {
          const contrast = textContrastColor(c.hex);
          const isCopied = copiedHex === c.hex;
          return (
            <div
              key={c.colourId}
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-3 transition-all hover:border-plum/40 hover:shadow-xs"
            >
              <div
                className="relative flex aspect-square w-full items-center justify-center rounded-lg shadow-inner transition-transform group-hover:scale-[1.02]"
                style={{ backgroundColor: c.hex }}
              >
                <button
                  type="button"
                  onClick={() => handleCopy(c.hex)}
                  className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100 hover:bg-black/60"
                  aria-label={`Copy hex code ${c.hex}`}
                >
                  {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  <span>{isCopied ? 'Copied' : c.hex}</span>
                </button>
              </div>

              <div className="mt-2.5 space-y-1">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-medium text-xs text-foreground truncate">{c.name}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="uppercase font-mono">{c.hex}</span>
                  <span className="capitalize">{c.family}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
