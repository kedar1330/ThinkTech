import { describe, expect, it, vi } from 'vitest';
import { ShoppingProviderError, serperShoppingProvider } from '../../src/integrations/shopping/serper-client';

// The Serper.dev shopping client (#118) against a fake fetch: no network, no real key. Listings are synthetic.

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

const search = (fetchImpl: typeof fetch) =>
  serperShoppingProvider('synthetic-key', fetchImpl).search('navy kurta women', new AbortController().signal);

const cause = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return err instanceof ShoppingProviderError ? err.cause : 'other';
  }
  return 'none';
};

describe('serperShoppingProvider', () => {
  it('posts the query for India with the key in a header, and returns store and price text', async () => {
    const fetchImpl = reply(200, {
      shopping: [
        { title: 'Synthetic kurta', source: 'Amazon.in', price: '₹1,299.00', link: 'https://shop.example/a' },
        { title: 'No price', source: 'Flipkart' },
        { source: 'Meesho', price: '₹449' },
      ],
    });
    const listings = await search(fetchImpl as unknown as typeof fetch);
    expect(listings).toEqual([
      { source: 'Amazon.in', price: '₹1,299.00', link: 'https://shop.example/a' },
      { source: 'Meesho', price: '₹449', link: null },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://google.serper.dev/shopping');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-api-key': 'synthetic-key' });
    expect(JSON.parse(init.body as string)).toEqual({ q: 'navy kurta women', gl: 'in', hl: 'en' });
  });

  it('maps failures to causes that are safe to log', async () => {
    expect(await cause(search(reply(403, { message: 'Unauthorized.' }) as unknown as typeof fetch))).toBe(
      'unauthorized',
    );
    expect(await cause(search(reply(429, {}) as unknown as typeof fetch))).toBe('rate_limited');
    expect(await cause(search(reply(500, {}) as unknown as typeof fetch))).toBe('provider_error');
    expect(await cause(search(reply(200, 'not json') as unknown as typeof fetch))).toBe('invalid_output');
    expect(await cause(search(reply(200, { organic: [] }) as unknown as typeof fetch))).toBe('invalid_output');
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    expect(await cause(search(down as unknown as typeof fetch))).toBe('provider_error');
  });
});
