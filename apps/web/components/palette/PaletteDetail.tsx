import Link from 'next/link';
import type { PaletteSummary } from '@styleme/contracts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ColourSwatch } from './ColourSwatch';
import { contrastLevelLabel, paletteFamilies, textContrastColor } from '@/lib/palette/palette-utils';

export function PaletteDetail({ palette }: { palette: PaletteSummary }) {
  const families = paletteFamilies(palette);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div>
        <Link
          href="/palette"
          className="inline-flex items-center gap-1.5 text-sm text-plum hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
        >
          ← Back to palettes
        </Link>
      </div>

      <header className="space-y-4">
        <div className="space-y-1">
          {families.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">{families.join(' · ')}</p>
          )}
          <h1 className="font-display text-4xl text-primary">{palette.name}</h1>
        </div>

        <p className="text-base text-foreground leading-relaxed max-w-3xl">{palette.rationale}</p>

        <div className="rounded-lg border-l-2 border-plum/40 bg-surface-muted/50 p-3 text-xs text-muted-foreground max-w-3xl">
          <p className="font-medium text-foreground mb-0.5">Styling guidance & limitations</p>
          <p>{palette.limitations}</p>
        </div>

        {palette.suggestedBecause.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <span>Ranked for:</span>
            {palette.suggestedBecause.map((reason) => (
              <Badge key={reason} className="text-[11px] border-border bg-surface-muted text-muted-foreground">
                {reason}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* 1. Large Swatches */}
      <section aria-labelledby="palette-colours-heading" className="space-y-4">
        <div>
          <h2 id="palette-colours-heading" className="font-display text-2xl text-primary">
            Palette colours
          </h2>
          <p className="text-sm text-muted-foreground">
            Foundation neutrals and accents with names, hex codes, and contrast-tested swatches.
          </p>
        </div>

        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
          aria-label="Large colour swatches"
        >
          {palette.neutrals.map((swatch) => (
            <li key={swatch.colorId}>
              <ColourSwatch swatch={swatch} size="lg" roleLabel="Neutral" />
            </li>
          ))}
          {palette.accents.map((swatch) => (
            <li key={swatch.colorId}>
              <ColourSwatch swatch={swatch} size="lg" roleLabel="Accent" />
            </li>
          ))}
        </ul>
      </section>

      {/* 2. Coordinating Colours */}
      <section aria-labelledby="coordinating-colours-heading" className="space-y-4">
        <div>
          <h2 id="coordinating-colours-heading" className="font-display text-2xl text-primary">
            Coordinating colours
          </h2>
          <p className="text-sm text-muted-foreground">
            How neutral base tones and accents coordinate to create harmonious outfits.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <h3 className="font-display text-xl text-primary">Foundation neutrals</h3>
              <p className="text-xs text-muted-foreground">
                Base colours that ground your outfit and pair reliably with any accent in this palette.
              </p>
            </div>
            <ul aria-label="Foundation neutrals" className="space-y-2">
              {palette.neutrals.map((swatch) => (
                <li key={swatch.colorId}>
                  <ColourSwatch swatch={swatch} size="md" roleLabel="Neutral" />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="space-y-1">
              <h3 className="font-display text-xl text-primary">Coordinating accents</h3>
              <p className="text-xs text-muted-foreground">
                Livelier tones that complement the neutrals and create focal points or contrast.
              </p>
            </div>
            <ul aria-label="Coordinating accents" className="space-y-2">
              {palette.accents.map((swatch) => (
                <li key={swatch.colorId}>
                  <ColourSwatch swatch={swatch} size="md" roleLabel="Accent" />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* 3. Combinations with Contrast Labels */}
      <section aria-labelledby="combinations-heading" className="space-y-4">
        <div>
          <h2 id="combinations-heading" className="font-display text-2xl text-primary">
            Curated combinations
          </h2>
          <p className="text-sm text-muted-foreground">
            Tested colour pairings showing different levels of contrast and colour balance.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Curated combinations">
          {palette.combinations.map((combination, index) => (
            <li key={index}>
              <Card className="flex h-full flex-col justify-between space-y-4 p-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg text-primary">Combination {index + 1}</h3>
                    <Badge className="text-xs font-medium border-border bg-surface text-foreground">
                      {contrastLevelLabel(combination.contrastLevel)}
                    </Badge>
                  </div>

                  {/* Visual preview strip of combination colours */}
                  <div
                    className="flex h-10 w-full overflow-hidden rounded-lg border border-black/10 shadow-xs"
                    role="img"
                    aria-label={`Combination colours: ${combination.colors.map((c) => c.name).join(', ')}`}
                  >
                    {combination.colors.map((color) => (
                      <div
                        key={color.colorId}
                        className="flex h-full flex-1 items-center justify-center text-[10px] font-medium"
                        style={{
                          backgroundColor: color.hex,
                          color: textContrastColor(color.hex),
                        }}
                      >
                        <span className="truncate px-1">{color.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* List of swatches in combination */}
                  <ul className="space-y-2 pt-1" aria-label={`Colours in combination ${index + 1}`}>
                    {combination.colors.map((color) => (
                      <li key={color.colorId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            aria-hidden
                            className="size-4 shrink-0 rounded-full border border-black/10"
                            style={{ backgroundColor: color.hex }}
                          />
                          <span className="truncate font-medium text-foreground">{color.name}</span>
                        </div>
                        <span className="font-mono text-muted-foreground shrink-0">{color.hex}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
