import type { Metadata } from 'next';
import Link from 'next/link';
import type { ShortlistListResponse } from '@styleme/contracts';
import { ShortlistForm } from '@/components/shop/ShortlistForm';
import { ShortlistItemCard } from '@/components/shop/ShortlistItemCard';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Your shortlist' };

const PAGE_SIZE = 20;

/** `?page=` as a positive whole number; anything else is the first page. */
function pageFrom(raw: string | undefined): number {
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

const pageLink =
  'rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-plum/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

/**
 * Items the user found in other shops (FR-LIST, D-77 = B): add, list newest first, remove. There is no
 * budget status here; price summaries belong to a saved look (FR-BUD-07, #43).
 */
export default async function ShortlistPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { accessToken } = await requireOnboarded();
  const page = pageFrom((await searchParams).page);
  const { items, total } = await apiRequest<ShortlistListResponse>(`/v1/shortlist?page=${page}&limit=${PAGE_SIZE}`, {
    token: accessToken,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Shop My Look</p>
        <h1 className="font-display text-4xl text-primary">Your shortlist</h1>
        <p className="text-sm text-muted-foreground">
          Keep items you found in other shops, with the price you saw. StyleMe does not check these items, prices or
          links, and never opens your links.
        </p>
        {/* FR-LIST-06. Provisional wording until the legal review of the privacy notice (D-74). */}
        <p className="text-sm text-muted-foreground">
          Your shortlist is private to you. It is never used for other people&rsquo;s suggestions, never sent to an AI
          service, and is deleted with your account.
        </p>
      </header>

      <Card className="space-y-4">
        <h2 className="font-display text-2xl text-primary">Add an item you found</h2>
        <ShortlistForm />
      </Card>

      <section aria-labelledby="shortlist-items" className="space-y-4">
        <h2 id="shortlist-items" className="font-display text-2xl text-primary">
          Saved items {total > 0 && <span className="text-base text-muted-foreground">({total})</span>}
        </h2>
        {total === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing here yet. When you find something you like in another shop, add it above to keep track of it.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no items on this page.{' '}
            <Link href="/shortlist" className="text-plum underline underline-offset-4">
              Go to the first page
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <ShortlistItemCard item={item} />
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && items.length > 0 && (
          <nav aria-label="Shortlist pages" className="flex flex-wrap items-center justify-between gap-3">
            {page > 1 ? (
              <Link href={`/shortlist?page=${page - 1}`} className={pageLink}>
                Newer items
              </Link>
            ) : (
              <span />
            )}
            <p className="text-sm text-muted-foreground">
              Page {page} of {pages}
            </p>
            {page < pages ? (
              <Link href={`/shortlist?page=${page + 1}`} className={pageLink}>
                Older items
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
