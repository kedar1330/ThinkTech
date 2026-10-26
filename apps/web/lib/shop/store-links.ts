import type { PriceRangeStore } from '@styleme/contracts';

// Store links for similar items (#134). Serper.dev returns no store URLs, only Google Shopping overlay links
// (and sometimes none), so each item links to its own store's search for the store's own title. That works
// for every listing and lands on the store; it is a search, not a guaranteed product page, and is named so.

const SEARCH: Record<PriceRangeStore, (q: string) => string> = {
  amazon: (q) => `https://www.amazon.in/s?k=${q}`,
  flipkart: (q) => `https://www.flipkart.com/search?q=${q}`,
  meesho: (q) => `https://www.meesho.com/search?q=${q}`,
};

/** The store's own search for an item's title, e.g. `https://www.amazon.in/s?k=Women%20White%20Shirt`. */
export function storeSearchUrl(store: PriceRangeStore | string, title: string): string {
  const fn = (SEARCH as Record<string, (q: string) => string>)[store];
  if (!fn) return `https://www.google.com/search?q=${encodeURIComponent(title.trim())}`;
  return fn(encodeURIComponent(title.trim()));
}
