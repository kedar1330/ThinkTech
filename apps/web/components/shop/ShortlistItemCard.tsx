import { ExternalLink } from 'lucide-react';
import { USER_ENTERED_LABELS, type UserShortlistItem } from '@styleme/contracts';
import { Card } from '@/components/ui/card';
import { formatInr } from '@/lib/shop/format';
import { RemoveShortlistItem } from './RemoveShortlistItem';

// One item the user found elsewhere (FR-LIST-02, -03, -05). Only what the user typed is shown, always
// with the "not verified" labels. The link is a plain outbound link exactly as entered: never fetched,
// previewed or rewritten, and no shop name, logo or image is derived from it.

const added = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

export function ShortlistItemCard({ item }: { item: UserShortlistItem }) {
  return (
    <Card className="min-w-0 space-y-3 p-5">
      <div className="space-y-1">
        <h3 className="break-words font-display text-xl text-primary">{item.name}</h3>
        <p className="text-xs text-muted-foreground">{USER_ENTERED_LABELS.item}</p>
      </div>
      <div className="space-y-0.5">
        <p className="text-lg font-semibold">{formatInr(item.priceEntered)}</p>
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
      {item.note && <p className="whitespace-pre-line break-words text-sm">{item.note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">Added {added.format(new Date(item.createdAt))}</p>
        <RemoveShortlistItem id={item.id} name={item.name} />
      </div>
    </Card>
  );
}
