'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { USER_ENTERED_LABELS, type UserShortlistItem } from '@styleme/contracts';
import { attachItemAction, detachItemAction } from '@/app/actions/shop';
import { formatInr } from '@/lib/shop/format';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

// One part of a saved look in Shop My Look (#43): the item the user put on it, or a picker over their
// unattached shortlist items. Every name, price and link is the user's own entry, labelled as not verified
// (FR-LIST-02); links are plain outbound links, never fetched or rewritten (FR-LIST-03, -05).

function AttachedItem({ item, partName }: { item: UserShortlistItem; partName: string }) {
  const [state, action, pending] = useActionState(detachItemAction, undefined);
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="space-y-0.5">
        <p className="break-words font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">{USER_ENTERED_LABELS.item}</p>
      </div>
      <div className="space-y-0.5">
        <p className="font-semibold">{formatInr(item.priceEntered)}</p>
        <p className="text-xs text-muted-foreground">{USER_ENTERED_LABELS.price}</p>
      </div>
      {item.url && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex max-w-full items-start gap-1.5 text-sm text-plum underline underline-offset-4 hover:no-underline"
        >
          <span className="line-clamp-2 break-all">{item.url}</span>
          <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="sr-only">{' (opens in a new tab)'}</span>
        </a>
      )}
      <form action={action}>
        <input type="hidden" name="itemId" value={item.id} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending}
          aria-label={`Take ${item.name} off ${partName}`}
        >
          Take off this look
        </Button>
      </form>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </div>
  );
}

export function SlotItemPicker({
  outfitId,
  slotId,
  partName,
  attached,
  items,
  filtered = false,
}: {
  outfitId: string;
  slotId: string;
  /** e.g. "Kurta", for accessible names. */
  partName: string;
  attached?: UserShortlistItem;
  /** The unattached items within the current price filter. */
  items: readonly UserShortlistItem[];
  /** The price filter hides some unattached items. */
  filtered?: boolean;
}) {
  const [state, action, pending] = useActionState(attachItemAction, undefined);
  if (attached) return <AttachedItem item={attached} partName={partName} />;

  const pickerId = `pick-${slotId}`;
  if (items.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        {filtered
          ? 'None of your unattached shortlist items are within this price.'
          : 'Your shortlist has no items to add yet.'}{' '}
        <Link href="/shortlist" className="font-medium text-plum underline">
          Add an item you found
        </Link>
      </p>
    );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="outfitId" value={outfitId} />
      <input type="hidden" name="slotId" value={slotId} />
      <Label htmlFor={pickerId}>Add an item from your shortlist for {partName.toLowerCase()}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id={pickerId}
          name="itemId"
          required
          defaultValue=""
          className="flex h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="" disabled>
            Choose an item
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {formatInr(item.priceEntered)}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending} className="shrink-0">
          Add to look
        </Button>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
