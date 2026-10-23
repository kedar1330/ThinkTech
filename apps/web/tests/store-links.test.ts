import { describe, expect, it } from 'vitest';
import { storeSearchUrl } from '@/lib/shop/store-links';

// Store links for similar items (#134): each store's own search for the item's title, safely encoded.

describe('storeSearchUrl', () => {
  it('builds each store’s search for the title', () => {
    expect(storeSearchUrl('amazon', 'Women White Cotton Shirt')).toBe(
      'https://www.amazon.in/s?k=Women%20White%20Cotton%20Shirt',
    );
    expect(storeSearchUrl('flipkart', 'Men Printed Kurta')).toBe(
      'https://www.flipkart.com/search?q=Men%20Printed%20Kurta',
    );
    expect(storeSearchUrl('meesho', 'Kurti')).toBe('https://www.meesho.com/search?q=Kurti');
  });

  it('encodes characters that would change the URL, and non-Latin text', () => {
    const url = new URL(storeSearchUrl('amazon', '  Shirt & Trousers #2 / 50% off  '));
    expect(url.host).toBe('www.amazon.in');
    expect(url.pathname).toBe('/s');
    expect(url.searchParams.get('k')).toBe('Shirt & Trousers #2 / 50% off');
    expect(url.hash).toBe('');
    expect(new URL(storeSearchUrl('flipkart', 'कुर्ता')).searchParams.get('q')).toBe('कुर्ता');
  });
});
