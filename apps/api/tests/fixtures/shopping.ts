import {
  ShoppingProviderError,
  type ShoppingFailure,
  type ShoppingListing,
  type ShoppingSearchProvider,
} from '../../src/integrations/shopping/serper-client';

// A fake store search provider (no real provider or key in tests). It records every query it receives, so
// tests can check that nothing about the user leaves the API, and replies as told. Listings are synthetic.

export type FakeShoppingReply =
  { kind: 'listings'; listings: ShoppingListing[] } | { kind: 'fail'; cause: ShoppingFailure };

export const listing = (source: string, price: string, title = `Synthetic ${source} item`): ShoppingListing => ({
  source,
  price,
  title,
  link: 'https://www.google.com/search?ibp=oshop&q=synthetic',
  imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:synthetic',
});

export class FakeShoppingProvider implements ShoppingSearchProvider {
  readonly name = 'fake';
  readonly queries: string[] = [];
  reply: FakeShoppingReply = {
    kind: 'listings',
    listings: [
      listing('Amazon.in', '₹1,299.00'),
      listing('Flipkart', '₹899'),
      listing('Meesho', 'Rs. 449'),
      listing('Myntra', '₹2,499.00'),
    ],
  };

  /** When set, answers each query with its own listings instead of `reply` (#133). */
  respond?: (query: string) => ShoppingListing[];

  async search(query: string): Promise<ShoppingListing[]> {
    this.queries.push(query);
    if (this.reply.kind === 'fail') throw new ShoppingProviderError(this.reply.cause);
    return this.respond ? this.respond(query) : this.reply.listings;
  }
}
