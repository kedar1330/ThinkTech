import Link from 'next/link';
import type { PaletteSummary } from '@styleme/contracts';
import { Badge } from '@/components/ui/badge';

export interface WhyThesePalettesProps {
  palettes?: PaletteSummary[];
  view?: 'suggested' | 'all';
  isFallback?: boolean;
}

/**
 * WhyThesePalettes panel (FR-PAL-04, FR-PAL-07, #40).
 * Explains what factors ranked the recommended palettes or why general colour harmony was used.
 * Provides a clear "General, not personalised" label when tone, undertone, or preferences are missing.
 */
export function WhyThesePalettes({ palettes = [], view = 'suggested', isFallback }: WhyThesePalettesProps) {
  const isAll = view === 'all';
  const usedFactors = Array.from(new Set(palettes.flatMap((p) => p.suggestedBecause || [])));
  const hasSignals = usedFactors.includes('undertone') || usedFactors.includes('skinTone');
  const hasPreferences = usedFactors.some(
    (f) =>
      ['likedColors', 'contrastPreference', 'preferredOccasions'].includes(f) ||
      (!['undertone', 'skinTone'].includes(f) && f.length > 0),
  );

  const fallback = isFallback !== undefined ? isFallback : !isAll && (!hasSignals || usedFactors.length === 0);

  return (
    <section
      aria-labelledby="why-palettes-heading"
      data-testid="why-these-palettes"
      className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="why-palettes-heading" className="font-display text-base font-semibold text-primary">
          Why am I seeing these?
        </h2>
        {isAll ? (
          <Badge className="border-border bg-surface-muted text-muted-foreground font-medium">
            General, not personalised
          </Badge>
        ) : fallback ? (
          <Badge className="border-border bg-surface-muted text-muted-foreground font-medium">
            General, not personalised
          </Badge>
        ) : (
          <Badge className="border-plum/30 bg-plum/10 text-plum font-medium">Personalised for you</Badge>
        )}
      </div>

      {isAll ? (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>
            Showing all approved colour palettes in standard catalog order. These palettes are not personalised. Switch
            to Recommended for You to see colour combinations tailored to your profile.
          </p>
          <div>
            <Link
              href="/profile"
              className="inline-flex items-center text-xs font-medium text-plum hover:underline underline-offset-4"
            >
              View your style profile →
            </Link>
          </div>
        </div>
      ) : fallback ? (
        <div className="space-y-2 text-xs text-muted-foreground">
          {usedFactors.length === 0 ? (
            <p>
              Colour preferences and appearance signals are missing from your profile. Palettes are shown in general
              catalog order based on classic colour harmony. Add your colour preferences or appearance signals in your
              profile to see personalised recommendations.
            </p>
          ) : !hasSignals ? (
            <p>
              Appearance signals (skin tone and undertone) are not used (none saved, or switched off). Palettes are
              ranked using your saved colour preferences.
            </p>
          ) : (
            <p>
              Colour preferences are missing from your profile. Palettes are ranked using your appearance signals
              (undertone and skin tone).
            </p>
          )}

          {hasPreferences && (
            <div className="space-y-1 pt-1">
              <p className="font-medium text-foreground">Preferences used:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {usedFactors
                  .filter((f) => f !== 'undertone' && f !== 'skinTone')
                  .map((factor) => (
                    <li key={factor}>
                      {factor === 'likedColors'
                        ? 'Liked colours'
                        : factor === 'contrastPreference'
                          ? 'Contrast preference'
                          : factor === 'preferredOccasions'
                            ? 'Preferred occasions'
                            : factor}
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="pt-1">
            <Link
              href="/profile"
              className="inline-flex items-center text-xs font-medium text-plum hover:underline underline-offset-4"
            >
              Update your style profile →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-xs text-muted-foreground">
          <p>These palettes are personalised for you based on your appearance signals and style profile preferences.</p>
          <div className="space-y-1 pt-1">
            <p className="font-medium text-foreground">What was used:</p>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              {usedFactors.includes('undertone') && <li>Undertone suitability</li>}
              {usedFactors.includes('skinTone') && <li>Skin tone suitability</li>}
              {usedFactors.includes('likedColors') && <li>Liked colours from your profile</li>}
              {usedFactors.includes('contrastPreference') && <li>Contrast level preference</li>}
              {usedFactors.includes('preferredOccasions') && <li>Preferred dressing occasions</li>}
              {usedFactors
                .filter(
                  (f) =>
                    !['undertone', 'skinTone', 'likedColors', 'contrastPreference', 'preferredOccasions'].includes(f),
                )
                .map((f) => (
                  <li key={f}>{f}</li>
                ))}
            </ul>
          </div>
          <div className="pt-1">
            <Link
              href="/profile"
              className="inline-flex items-center text-xs font-medium text-plum hover:underline underline-offset-4"
            >
              Manage your style profile and signals →
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
