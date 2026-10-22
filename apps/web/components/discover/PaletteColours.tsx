import Link from 'next/link';
import type { ColourPreferencesResponse } from '@styleme/contracts';

// The colours liked and avoided in My Colour Palette (D-133), shown on Discover My Style because looks use them:
// liked colours are preferred, and near-identical avoided ones are left out.

const SHOWN = 12;

export function PaletteColours({ colours }: { colours: ColourPreferencesResponse | null }) {
  const liked = colours?.liked ?? [];
  const avoided = colours?.avoided ?? [];
  return (
    <section
      aria-labelledby="palette-colours-heading"
      className="space-y-3 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="palette-colours-heading" className="font-display text-xl text-primary">
          Your colours
        </h2>
        <Link href="/palette/colours" className="inline-flex min-h-11 items-center text-sm text-plum underline">
          {liked.length > 0 ? 'Edit in My Colour Palette' : 'Choose colours in My Colour Palette'}
        </Link>
      </div>
      {liked.length > 0 ? (
        <>
          <ul aria-label="Liked colours" className="flex flex-wrap gap-2">
            {liked.slice(0, SHOWN).map((c) => (
              <li
                key={c.colourId}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
              >
                <span
                  aria-hidden
                  className="size-3.5 shrink-0 rounded-full border border-foreground/20"
                  style={{ backgroundColor: c.hex }}
                />
                {c.name}
              </li>
            ))}
            {liked.length > SHOWN && (
              <li className="inline-flex items-center px-1 text-xs text-muted-foreground">
                +{liked.length - SHOWN} more
              </li>
            )}
          </ul>
          <p className="text-xs text-muted-foreground">
            Your looks favour these colours
            {avoided.length > 0 ? `, and leave out colours that look the same as the ${avoided.length} you avoid` : ''}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Like colours in My Colour Palette and your looks will favour them.
        </p>
      )}
    </section>
  );
}
