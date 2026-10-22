import Link from 'next/link';
import type { Look } from '@styleme/contracts';
import { lookTitle } from '@/lib/outfits/look-text';
import { cn } from '@/lib/utils';
import { TabPhoto } from './TabPhoto';
import { TabPriceRange } from './TabPriceRange';
import { TryOnButton } from './TryOnButton';

/**
 * Shop My Look tabs (#115): one small tab per saved look from Discover My Style, newest first, each with
 * the outfit's photo and its price range from store search results (#118), and its Virtual Try-On button. A tab is a link to `/shop?outfitId=<id>`, so the selected look lives in the
 * URL and the "Shop this look" links open the right tab. The strip scrolls sideways on small screens.
 */
export function LookTabs({ looks, selectedId }: { looks: Look[]; selectedId?: string }) {
  return (
    <nav aria-label="Your looks from Discover My Style" className="min-w-0">
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {looks.map((look) => {
          const title = lookTitle(look);
          const selected = look.id === selectedId;
          return (
            <li
              key={look.id}
              className={cn(
                'flex w-56 shrink-0 flex-col gap-2 rounded-2xl border p-3 transition-colors',
                selected ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-plum/60',
              )}
            >
              <TabPhoto look={look} title={title} />
              <Link
                href={`/shop?outfitId=${look.id}`}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'line-clamp-2 text-sm font-medium underline-offset-4 hover:underline',
                  selected ? 'text-primary' : 'text-foreground',
                )}
              >
                {title}
              </Link>
              <TabPriceRange outfitId={look.id} />
              <div className="mt-auto">
                <TryOnButton outfitId={look.id} lookName={title} />
              </div>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
