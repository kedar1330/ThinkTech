import Link from 'next/link';
import { USER_ENTERED_LABELS, type UserPriceSummary } from '@styleme/contracts';
import { formatInr } from '@/lib/shop/format';

/** The total of the user's own prices for a saved look (FR-BUD-07), always with its label (FR-LIST-02). */
export function PriceSummary({ summary }: { summary?: UserPriceSummary }) {
  if (!summary)
    return (
      <p className="text-sm text-muted-foreground">
        Add items from your shortlist to the parts below to see their total against your budget per look.
      </p>
    );
  const remaining = summary.budgetRemaining ?? 0;
  return (
    <div className="space-y-1" aria-label="Price summary" role="group">
      <p className="text-lg font-semibold">
        {summary.complete ? 'Total' : 'Total so far'}: {formatInr(summary.itemsTotal)}
      </p>
      <p className="text-xs text-muted-foreground">{USER_ENTERED_LABELS.total}</p>
      <p className="text-sm">
        {summary.pricedSlots} of {summary.totalSlots} parts priced
      </p>
      {summary.status === 'no_budget' ? (
        <p className="text-sm">
          No budget per look set.{' '}
          <Link href="/profile#style-profile" className="font-medium text-plum underline">
            Add one in your profile
          </Link>
        </p>
      ) : summary.status === 'within_budget' ? (
        <p className="text-sm">
          Within your {formatInr(summary.budget!)} budget per look: {formatInr(remaining)} left.
        </p>
      ) : (
        <p className="text-sm font-medium text-destructive">
          Over your {formatInr(summary.budget!)} budget per look by {formatInr(-remaining)}.
        </p>
      )}
    </div>
  );
}
