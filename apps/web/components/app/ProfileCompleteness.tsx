import Link from 'next/link';
import { ArrowRight, CircleDashed } from 'lucide-react';
import type { ProfileCompleteness, ProfileCompletenessItemId } from '@styleme/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Where each missing item is added: the city lives in account details, the rest in the style profile. */
export const COMPLETENESS_HREF: Record<ProfileCompletenessItemId, string> = {
  department: '/profile#basics',
  height: '/profile#basics',
  city: '/settings#details',
  skinTone: '/profile#skin-tone',
  bodyType: '/profile#body-type',
};

/**
 * "Complete your profile" (FR-ONB-05). Lists what is still missing, with a link to where each item is
 * added. Renders nothing when the profile is complete. `compact` is the short form for the profile page.
 */
export function ProfileCompletenessCard({
  completeness,
  compact = false,
}: {
  completeness: ProfileCompleteness;
  compact?: boolean;
}) {
  if (completeness.complete) return null;
  const { done, total, missing } = completeness;
  const percent = Math.round((done / total) * 100);

  return (
    <section
      aria-labelledby="profile-completeness-title"
      className={cn(
        'relative overflow-hidden rounded-2xl border border-accent/50 bg-gradient-to-br from-accent-soft/40 via-surface to-accent-soft/20 shadow-sm transition-all duration-300 card-lift',
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-7',
      )}
    >
      {/* Decorative subtle ambient circle */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-accent/10 blur-2xl"
      />

      <div className="relative space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/60 bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                {percent}% Complete
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {done} of {total} done
              </span>
            </div>
            <h2 id="profile-completeness-title" className="font-display text-2xl sm:text-3xl text-primary">
              Complete your profile
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              StyleMe works without these, but adding them makes suggestions fit you better.
            </p>
          </div>
          {!compact && (
            <Button asChild size="default" variant="accent" className="shadow-xs self-start">
              <Link href="/profile#basics">
                Complete my profile <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          )}
        </div>

        {/* Enhanced progress bar with gradient */}
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="Profile completeness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-muted/90 p-0.5 shadow-inner"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent via-plum to-primary transition-all duration-700 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Missing details cards */}
        <ul className={cn('grid gap-3 pt-1', !compact && 'sm:grid-cols-2')}>
          {missing.map((item) => (
            <li key={item.id}>
              <Link
                href={COMPLETENESS_HREF[item.id]}
                className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/90 px-4 py-3 text-sm transition-all duration-200 hover:border-plum/60 hover:bg-surface hover:shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-plum/10 text-plum transition-transform group-hover:scale-110">
                    <CircleDashed aria-hidden className="size-3.5" />
                  </div>
                  <span className="min-w-0">
                    <span className="font-medium text-foreground group-hover:text-plum transition-colors">
                      {item.label}
                    </span>
                    {!compact && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
                  </span>
                </div>
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-1 group-hover:text-plum"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
