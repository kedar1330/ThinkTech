import type { SlotAlternative } from '@styleme/contracts';
import { categoryLabel, specHints } from '@/lib/discover/look-spec';
import { SearchPhrase } from './SearchPhrase';
import { Swatch } from './Swatch';

// Alternatives for one slot (FR-LOOK-14, AC-12): 3 – 5 when the engine has them, otherwise exactly what it
// returned with the ALTERNATIVES_LIMITED message. Never padded (D-53). Shared with saved looks (#42).

export const MIN_ALTERNATIVES = 3;
export const MAX_ALTERNATIVES = 5;

export function SlotAlternatives({ alternatives }: { alternatives: readonly SlotAlternative[] }) {
  const shown = alternatives.slice(0, MAX_ALTERNATIVES);
  const limited = shown.length < MIN_ALTERNATIVES;
  if (shown.length === 0) return <p className="text-xs text-muted-foreground">No alternatives for this item yet.</p>;

  return (
    <details className="rounded-lg border border-border px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        {shown.length} {shown.length === 1 ? 'alternative' : 'alternatives'}
      </summary>
      {limited && (
        <p className="mt-2 text-xs text-muted-foreground">
          Only {shown.length} suitable {shown.length === 1 ? 'alternative was' : 'alternatives were'} found for this
          item.
        </p>
      )}
      <ul aria-label="Alternatives" className="mt-2 space-y-3">
        {shown.map((alt, i) => {
          const hints = specHints(alt.lookSpec);
          return (
            <li
              key={`${i}-${alt.searchPhrase}`}
              className="space-y-1 border-t border-border pt-2 first:border-t-0 first:pt-0"
            >
              <p className="text-xs font-medium">{categoryLabel(alt.lookSpec)}</p>
              <ul aria-label="Colours" className="flex flex-wrap gap-x-3 gap-y-1">
                {alt.swatches.map((swatch) => (
                  <li key={swatch.colorId}>
                    <Swatch swatch={swatch} />
                  </li>
                ))}
              </ul>
              {hints.length > 0 && <p className="text-xs text-muted-foreground">{hints.join(' · ')}</p>}
              <SearchPhrase phrase={alt.searchPhrase} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}
