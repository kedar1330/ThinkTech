import Link from 'next/link';
import { Heart } from 'lucide-react';
import type { OutfitListResponse } from '@styleme/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SavedLookCard } from './SavedLookCard';

// One page of saved looks (FR-OUT-02) with the count and page links, or the empty state.

function EmptyState() {
  return (
    <Card className="flex flex-col items-start gap-4 sm:flex-row">
      <Heart aria-hidden className="mt-1 size-6 shrink-0 text-accent" />
      <div className="space-y-3">
        <h2 className="font-display text-2xl text-primary">No saved looks yet</h2>
        <p className="text-sm text-muted-foreground">
          When you find a look you like, save it and it will be kept here for you to come back to.
        </p>
        <Button asChild>
          <Link href="/discover/looks">Find looks for an occasion</Link>
        </Button>
      </div>
    </Card>
  );
}

export function SavedLookList({ looks, page, limit, total }: OutfitListResponse) {
  if (total === 0) return <EmptyState />;
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {total} saved {total === 1 ? 'look' : 'looks'}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {looks.map((look) => (
          <li key={look.id}>
            <SavedLookCard look={look} />
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Saved looks pages" className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/saved?page=${page - 1}`}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/saved?page=${page + 1}`}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
