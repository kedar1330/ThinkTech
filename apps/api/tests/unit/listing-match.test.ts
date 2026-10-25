import { describe, expect, it } from 'vitest';
import type { LookSpec } from '@styleme/contracts';
import {
  byRelevance,
  categoryQuery,
  departmentConfirmed,
  matchedAttributes,
  relevanceOf,
  termsFor,
} from '../../src/services/listing-match';

// Matching store titles to a garment's attributes (#133). Only words in the title count.

const kurta: LookSpec = {
  category: 'kurta',
  colorFamily: 'blue',
  colorId: 'navy',
  fabric: 'cotton',
  fit: 'regular',
  neckline: 'mandarin',
  sleeve: 'three_quarter',
};

describe('matchedAttributes', () => {
  it('finds each attribute the title mentions, in lookSpec order', () => {
    expect(matchedAttributes('Men Navy Blue Cotton Regular Fit Mandarin Collar Kurta, 3/4 Sleeve', kurta)).toEqual([
      'category',
      'color',
      'fabric',
      'fit',
      'neckline',
      'sleeve',
    ]);
    expect(matchedAttributes('Printed Rayon Kurta for Men', kurta)).toEqual(['category']);
    expect(matchedAttributes('Women Solid Shirt', kurta)).toEqual([]);
  });

  it('matches whole words only, and plurals', () => {
    // "navya" is not navy; "kurtas" is kurta.
    expect(matchedAttributes('Navya Brand Kurtas Combo', kurta)).toEqual(['category']);
  });

  it('never matches a bare neckline or sleeve word out of context', () => {
    const roundShort: LookSpec = {
      category: 't_shirt',
      colorFamily: 'neutral',
      colorId: 'black',
      neckline: 'round',
      sleeve: 'short',
    };
    expect(matchedAttributes('Short Round Box T-shirt', roundShort)).toEqual(['category']);
    expect(matchedAttributes('Round Neck Half Sleeve Tshirt', roundShort)).toEqual(['category', 'neckline', 'sleeve']);
  });

  it('knows common ways stores write a value', () => {
    expect(termsFor('sleeve', 'three_quarter')).toContain('3/4');
    expect(termsFor('category', 'trousers')).toContain('pants');
    expect(termsFor('neckline', 'round')).not.toContain('round');
  });
});

describe('relevanceOf (Shop My Look accuracy)', () => {
  const khakiKurta: LookSpec = {
    category: 'kurta',
    colorFamily: 'brown',
    colorId: 'khaki',
    fabric: 'cotton',
    silhouette: 'straight',
    pattern: 'floral',
  };
  const trousers: LookSpec = { category: 'trousers', colorFamily: 'neutral', colorId: 'cream', fabric: 'cotton' };

  it('needs the garment named: other items are not matches', () => {
    expect(relevanceOf('KVS TOP Black', khakiKurta, 'women').relevant).toBe(false);
    expect(relevanceOf('ANOKHI 2', khakiKurta, 'women').relevant).toBe(false);
    expect(relevanceOf('Women Khaki Cotton Straight Kurta', khakiKurta, 'women')).toMatchObject({
      relevant: true,
      score: 4,
    });
  });

  it('treats kurta and kurti as the same garment', () => {
    expect(relevanceOf('Kurti for women', khakiKurta, 'women').matched).toContain('category');
  });

  it('needs a women’s item to say so when men wear the garment too', () => {
    // Seen on a women's kurti look: a men's kurta whose title doesn't say whose it is.
    const kurti: LookSpec = { ...khakiKurta, category: 'kurti', colorFamily: 'orange', colorId: 'peach' };
    expect(relevanceOf('Kurta-Cotton-Peach-Sinlge Pocket', kurti, 'women')).toMatchObject({
      relevant: true,
      confirmed: false,
    });
    expect(departmentConfirmed('Women Floral Print Straight Kurta', 'women')).toBe(true);
    expect(departmentConfirmed('Cotton Kurta with Dupatta', 'women')).toBe(true);
    expect(departmentConfirmed('Cotton Kurta', 'men')).toBe(false);
    expect(departmentConfirmed('Men Cotton Kurta', 'men')).toBe(true);
    // A kurti is women's wear only, so naming one is enough.
    expect(departmentConfirmed('Cotton Peach Kurti', 'women')).toBe(true);
    // Men-only garments are never women's wear.
    expect(relevanceOf('Cotton Pathani Kurta', khakiKurta, 'women').conflicts).toContain('department');
  });

  it('ranks confirmed items before unconfirmed ones, whatever their score or price', () => {
    const items = [
      { title: 'unconfirmed', confirmed: false, score: 5, price: 100 },
      { title: 'confirmed', confirmed: true, score: 2, price: 900 },
    ];
    expect(items.sort(byRelevance).map((i) => i.title)).toEqual(['confirmed', 'unconfirmed']);
  });

  it('reads words joined by hyphens', () => {
    expect(relevanceOf('Kurta-Cotton-Khaki-Single Pocket', khakiKurta, 'women').matched).toEqual([
      'category',
      'color',
      'fabric',
    ]);
  });

  it('leaves out another department and children’s wear', () => {
    expect(relevanceOf('Men Khaki Cotton Kurta', khakiKurta, 'women')).toMatchObject({
      relevant: false,
      conflicts: ['department'],
    });
    expect(relevanceOf('Women Khaki Kurta', khakiKurta, 'men').relevant).toBe(false);
    expect(relevanceOf('Girls Cotton Kurta', khakiKurta, 'women').conflicts).toContain('kids');
    expect(relevanceOf('Kids Cotton Kurta', khakiKurta, 'women').relevant).toBe(false);
    // Women's and girls' sizes in one listing is still for adults.
    expect(relevanceOf("Women's and Girls Straight Kurti", khakiKurta, 'women').relevant).toBe(true);
    expect(relevanceOf('Unisex Cotton Kurta', khakiKurta, 'women').relevant).toBe(true);
  });

  it('never offers a set as just its bottom, and ranks a set lower for a top', () => {
    const set = 'Kala Women’s Violet Cotton Blend Embroidered Straight Kurta With Trouser & Dupatta';
    expect(relevanceOf(set, trousers, 'women')).toMatchObject({ relevant: false });
    expect(relevanceOf(set, khakiKurta, 'women')).toMatchObject({ relevant: true, conflicts: ['set', 'color'] });
  });

  it('ranks another colour lower, but not a shade of the same family', () => {
    const plain = relevanceOf('Women Cotton Straight Kurta', khakiKurta, 'women');
    const violet = relevanceOf('Women Violet Cotton Straight Kurta', khakiKurta, 'women');
    expect(violet.conflicts).toEqual(['color']);
    expect(violet.score).toBe(plain.score - 1);
    expect(relevanceOf('Women Brown Cotton Kurta', khakiKurta, 'women').conflicts).toEqual([]);
  });

  it('does not count a blend as the fabric', () => {
    expect(matchedAttributes('Cotton Blend Kurta', khakiKurta)).toEqual(['category']);
    expect(matchedAttributes('Pure Cotton Kurta', khakiKurta)).toEqual(['category', 'fabric']);
  });
});

describe('categoryQuery', () => {
  it('is the garment category and the department only', () => {
    expect(categoryQuery(kurta, 'men')).toBe('kurta men');
    expect(categoryQuery({ ...kurta, category: 't_shirt' }, null)).toBe('t-shirt');
  });
});
