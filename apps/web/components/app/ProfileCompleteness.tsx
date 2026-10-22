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
        'space-y-4 rounded-xl border border-accent/60 bg-accent-soft/50 shadow-sm',
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 id="profile-completeness-title" className="font-display text-2xl text-primary">
            Complete your profile
          </h2>
          <p className="text-sm text-muted-foreground">
            {done} of {total} done. StyleMe works without these, but adding them makes suggestions fit you better.
          </p>
        </div>
        {!compact && (
          <Button asChild>
            <Link href="/profile#basics">
              Complete my profile <ArrowRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Profile completeness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-surface"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <ul className={cn('grid gap-2', !compact && 'sm:grid-cols-2')}>
        {missing.map((item) => (
          <li key={item.id}>
            <Link
              href={COMPLETENESS_HREF[item.id]}
              className="flex min-h-11 items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:border-plum/50"
            >
              <CircleDashed aria-hidden className="mt-0.5 size-4 shrink-0 text-plum" />
              <span className="min-w-0">
                <span className="font-medium">{item.label}</span>
                {!compact && <span className="block text-muted-foreground">{item.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
