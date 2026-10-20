import Link from 'next/link';

export interface ViewToggleProps {
  currentView?: 'suggested' | 'all';
}

/**
 * ViewToggle for My Colour Palette (FR-PAL-04, #40).
 * Switches between 'Recommended for You' (view=suggested) and 'Explore All Palettes' (view=all).
 */
export function ViewToggle({ currentView = 'suggested' }: ViewToggleProps) {
  const isSuggested = currentView !== 'all';

  return (
    <nav aria-label="Palette view" className="inline-flex rounded-lg border border-border bg-surface-muted/50 p-1">
      <Link
        href="/palette?view=suggested"
        aria-current={isSuggested ? 'page' : undefined}
        className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
          isSuggested ? 'bg-plum text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Recommended for You
      </Link>
      <Link
        href="/palette?view=all"
        aria-current={!isSuggested ? 'page' : undefined}
        className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-all ${
          !isSuggested ? 'bg-plum text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Explore All Palettes
      </Link>
    </nav>
  );
}
