import { describe, expect, it } from 'vitest';
import type { LookSlot, UserShortlistItem } from '@styleme/contracts';
import { filterOptions, filterSlots, parseMaxPrice, pickableItems, shopHref } from '../lib/shop/look-shopper';

// Shop My Look filters (#43): category and size group narrow the look's parts; price narrows the items.

const slot = (slotId: string, category: LookSlot['lookSpec']['category']): LookSlot => ({
  slotId,
  slot: 'top',
  lookSpec: { category, colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
  searchPhrase: `navy ${category}`,
  sizeNote: 'Add your size',
  alternatives: [],
});
const SLOTS = [
  slot('top', 'kurta'),
  slot('bottom', 'trousers'),
  slot('accessory-1', 'accessory'),
  slot('shoes', 'shoes'),
];

const item = (id: string, priceEntered: number, attached = false): UserShortlistItem => ({
  id: id.padStart(24, '0'),
  name: `Item ${id}`,
  priceEntered,
  currency: 'INR',
  priceBasis: 'user_entered',
  verifiedByStyleMe: false,
  url: null,
  note: null,
  outfitId: attached ? 'f'.repeat(24) : null,
  slotId: attached ? 'top' : null,
  createdAt: '2026-10-20T00:00:00.000Z',
});

describe('Shop My Look filters', () => {
  it('offers the categories and size groups present in the look, in vocabulary order', () => {
    expect(filterOptions(SLOTS)).toEqual({
      categories: ['trousers', 'kurta', 'shoes', 'accessory'],
      groups: ['bottoms', 'ethnicTops', 'freeSize', 'shoes'],
    });
  });

  it('narrows the parts by category and by size group', () => {
    expect(filterSlots(SLOTS, {}).map((s) => s.slotId)).toEqual(['top', 'bottom', 'accessory-1', 'shoes']);
    expect(filterSlots(SLOTS, { category: 'trousers' }).map((s) => s.slotId)).toEqual(['bottom']);
    expect(filterSlots(SLOTS, { group: 'freeSize' }).map((s) => s.slotId)).toEqual(['accessory-1']);
    expect(filterSlots(SLOTS, { category: 'kurta', group: 'shoes' })).toEqual([]);
  });

  it('offers unattached items at or below the maximum price', () => {
    const items = [item('1', 500), item('2', 1500), item('3', 999.99), item('4', 100, true)];
    expect(pickableItems(items).map((i) => i.name)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    expect(pickableItems(items, 1000).map((i) => i.name)).toEqual(['Item 1', 'Item 3']);
    expect(pickableItems(items, 500).map((i) => i.name)).toEqual(['Item 1']);
  });

  it('reads a typed maximum price, with or without ₹ and commas', () => {
    expect(parseMaxPrice('1,500')).toBe(1500);
    expect(parseMaxPrice('₹ 999.50')).toBe(999.5);
    for (const none of ['', '  ', '0', '-5', 'abc']) expect(parseMaxPrice(none)).toBeUndefined();
  });

  it('builds the Shop this look link, optionally for one part', () => {
    expect(shopHref('a'.repeat(24))).toBe(`/shop?outfitId=${'a'.repeat(24)}`);
    expect(shopHref('a'.repeat(24), 'accessory-1')).toBe(`/shop?outfitId=${'a'.repeat(24)}&slotId=accessory-1`);
  });
});
