// Store search listings for price ranges (#118). The service talks to the `ShoppingSearchProvider`
// interface only; tests inject a fake through AppDeps, so CI needs no key. A query is a garment's search
// phrase and the department, nothing about the user. Nothing from the request or reply is logged.

export type ShoppingFailure = 'timeout' | 'rate_limited' | 'unauthorized' | 'provider_error' | 'invalid_output';

/** A provider failure with a cause that is safe to log (no request or response content). */
export class ShoppingProviderError extends Error {
  constructor(readonly cause: ShoppingFailure) {
    super(`Shopping search provider failed: ${cause}`);
    this.name = 'ShoppingProviderError';
  }
}

/** One listing as the provider returned it: the store name, the price text (unparsed), title, link, thumbnail. */
export interface ShoppingListing {
  source: string;
  price: string;
  title: string | null;
  link: string | null;
  imageUrl: string | null;
}

export interface ShoppingSearchProvider {
  readonly name: string;
  search(query: string, signal: AbortSignal): Promise<ShoppingListing[]>;
}

const SERPER_SHOPPING_URL = 'https://google.serper.dev/shopping';

/** Serper.dev Google Shopping search for India, with the secret key in the header, server-side only. */
export function serperShoppingProvider(apiKey: string, fetchImpl: typeof fetch = fetch): ShoppingSearchProvider {
  return {
    name: 'serper',
    async search(query, signal) {
      let res: Response;
      try {
        res = await fetchImpl(SERPER_SHOPPING_URL, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({ q: query, gl: 'in', hl: 'en' }),
          signal,
        });
      } catch {
        throw new ShoppingProviderError(signal.aborted ? 'timeout' : 'provider_error');
      }
      if (res.status === 429) throw new ShoppingProviderError('rate_limited');
      // A missing, wrong or exhausted key.
      if (res.status === 401 || res.status === 403) throw new ShoppingProviderError('unauthorized');
      if (!res.ok) throw new ShoppingProviderError('provider_error');
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new ShoppingProviderError(signal.aborted ? 'timeout' : 'invalid_output');
      }
      const shopping = (body as { shopping?: unknown } | null)?.shopping;
      if (!Array.isArray(shopping)) throw new ShoppingProviderError('invalid_output');
      return shopping.flatMap((raw): ShoppingListing[] => {
        const item = raw as { source?: unknown; price?: unknown; title?: unknown; link?: unknown; imageUrl?: unknown };
        if (typeof item.source !== 'string' || typeof item.price !== 'string') return [];
        const text = (v: unknown) => (typeof v === 'string' ? v : null);
        return [
          {
            source: item.source,
            price: item.price,
            title: text(item.title),
            link: text(item.link),
            imageUrl: text(item.imageUrl),
          },
        ];
      });
    },
  };
}
