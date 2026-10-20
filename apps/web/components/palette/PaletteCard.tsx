import Link from 'next/link';
import type { PaletteSummary } from '@styleme/contracts';
import { Card } from '@/components/ui/card';
import { ColourSwatch } from './ColourSwatch';
import { paletteFamilies } from '@/lib/palette/palette-utils';

export function PaletteCard({ palette }: { palette: PaletteSummary }) {
  const families = paletteFamilies(palette);
  const allSwatches = [...palette.neutrals, ...palette.accents];
  const headingId = `palette-title-${palette.id}`;

  return (
    <Card className="flex h-full flex-col justify-between p-5 hover:border-plum/40 hover:shadow-md transition-all">
      <article aria-labelledby={headingId} className="space-y-4">
        <header className="space-y-1">
          {families.length > 0 && (
            <p className="text-xs font-medium uppercase tracking-wider text-plum">{families.join(' · ')}</p>
          )}
          <h2 id={headingId} className="font-display text-2xl text-primary">
            <Link
              href={`/palette/${palette.id}`}
              className="hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
            >
              {palette.name}
            </Link>
          </h2>
        </header>

        <p className="text-sm text-muted-foreground line-clamp-3">{palette.rationale}</p>

        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-foreground">Palette colours ({allSwatches.length})</p>
          <ul aria-label={`Colours in ${palette.name}`} className="flex flex-wrap gap-1.5">
            {allSwatches.map((swatch) => (
              <li key={swatch.colorId}>
                <ColourSwatch swatch={swatch} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      </article>

      <footer className="pt-4 border-t border-border mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{palette.combinations.length} combinations</span>
        <Link
          href={`/palette/${palette.id}`}
          className="font-medium text-plum hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
        >
          View palette →
        </Link>
      </footer>
    </Card>
  );
}
