import { describe, expect, it } from 'vitest';
import type { LookSpec } from '@styleme/contracts';
import { categoryQuery, matchedAttributes, termsFor } from '../../src/services/listing-match';

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

describe('categoryQuery', () => {
  it('is the garment category and the department only', () => {
    expect(categoryQuery(kurta, 'men')).toBe('kurta men');
    expect(categoryQuery({ ...kurta, category: 't_shirt' }, null)).toBe('t-shirt');
  });
});
