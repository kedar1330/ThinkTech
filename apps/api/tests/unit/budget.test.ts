import { SHORTLIST_LIMITS, USER_ENTERED_LABELS, userPriceSummarySchema, type Category } from '@styleme/contracts';
import { describe, expect, it } from 'vitest';
import {
  BudgetInputError,
  calculatePriceSummary,
  filterByBudget,
  filterByCategory,
  formatInr,
  type AttachedPrice,
} from '../../src/services/budget';

// Budget engine on user-entered prices (FR-BUD-01 … 03, FR-BUD-07, AC-B3, TESTING.md B-07).
// Every summary is checked against the shared contract, so the API can return it unchanged.

const SLOTS = ['top', 'bottom', 'footwear'] as const;

function summary(items: AttachedPrice[], budget?: number | null, slotIds: readonly string[] = SLOTS) {
  const result = calculatePriceSummary({ slotIds }, items, budget);
  expect(userPriceSummarySchema.safeParse(result).success).toBe(true);
  return result;
}

function inputError(fn: () => unknown) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(BudgetInputError);
    return (err as BudgetInputError).code;
  }
  throw new Error('expected a BudgetInputError');
}

describe('calculatePriceSummary', () => {
  it('a look with no priced slots totals zero and is incomplete', () => {
    expect(summary([], 5000)).toEqual({
      priceBasis: 'user_entered',
      itemsTotal: 0,
      pricedSlots: 0,
      totalSlots: 3,
      complete: false,
      budget: 5000,
      budgetRemaining: 5000,
      status: 'within_budget',
      label: USER_ENTERED_LABELS.total,
    });
  });

  it('every slot priced: total, complete and budget remaining', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 1200 },
        { slotId: 'bottom', priceEntered: 900 },
        { slotId: 'footwear', priceEntered: 1500 },
      ],
      6000,
    );
    expect(result).toMatchObject({ itemsTotal: 3600, pricedSlots: 3, complete: true, budgetRemaining: 2400 });
    expect(result.status).toBe('within_budget');
  });

  it('B-07: 2 of 3 slots priced is incomplete', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 1200 },
        { slotId: 'footwear', priceEntered: 800 },
      ],
      5000,
    );
    expect(result).toMatchObject({ itemsTotal: 2000, pricedSlots: 2, totalSlots: 3, complete: false });
  });

  it('B-07: no budget set shows only the total (no_budget)', () => {
    for (const budget of [undefined, null]) {
      const result = summary([{ slotId: 'top', priceEntered: 1200 }], budget);
      expect(result).toMatchObject({ itemsTotal: 1200, budget: null, budgetRemaining: null, status: 'no_budget' });
    }
  });

  it('B-07 / FR-BUD-03: total exactly equal to the budget is within budget with ₹0 remaining', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 2500 },
        { slotId: 'bottom', priceEntered: 2500 },
      ],
      5000,
    );
    expect(result).toMatchObject({ itemsTotal: 5000, budgetRemaining: 0, status: 'within_budget' });
  });

  it('B-07: total one rupee above the budget is over budget with a negative remainder', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 2500 },
        { slotId: 'bottom', priceEntered: 2501 },
      ],
      5000,
    );
    expect(result).toMatchObject({ itemsTotal: 5001, budgetRemaining: -1, status: 'over_budget' });
  });

  it('adds paise exactly, without floating-point drift', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 0.1 },
        { slotId: 'bottom', priceEntered: 0.2 },
      ],
      1,
    );
    expect(result.itemsTotal).toBe(0.3);
    expect(result.budgetRemaining).toBe(0.7);
  });

  it('a total a few paise above the budget is over budget', () => {
    const result = summary(
      [
        { slotId: 'top', priceEntered: 999.99 },
        { slotId: 'bottom', priceEntered: 0.02 },
      ],
      1000,
    );
    expect(result).toMatchObject({ itemsTotal: 1000.01, budgetRemaining: -0.01, status: 'over_budget' });
  });

  it('accepts the maximum price on every slot', () => {
    const max = SHORTLIST_LIMITS.priceMax;
    const result = summary(
      SLOTS.map((slotId) => ({ slotId, priceEntered: max })),
      max,
    );
    expect(result).toMatchObject({ itemsTotal: 3 * max, budgetRemaining: -2 * max, status: 'over_budget' });
  });

  it('a single-slot look is complete once its slot is priced', () => {
    expect(summary([{ slotId: 'outfit', priceEntered: 4999 }], 5000, ['outfit'])).toMatchObject({
      pricedSlots: 1,
      totalSlots: 1,
      complete: true,
    });
  });

  it('does not change its inputs', () => {
    const items = [{ slotId: 'top', priceEntered: 100 }];
    const look = { slotIds: ['top', 'bottom'] };
    const before = JSON.stringify({ items, look });
    calculatePriceSummary(look, items, 500);
    expect(JSON.stringify({ items, look })).toBe(before);
  });

  describe('rejects invalid prices (D-80, FR-LIST-07)', () => {
    it.each([
      ['zero', 0],
      ['negative', -1],
      ['above ₹10,00,000', SHORTLIST_LIMITS.priceMax + 0.01],
      ['more than two decimal places', 10.005],
      ['NaN', Number.NaN],
      ['infinite', Number.POSITIVE_INFINITY],
    ])('%s', (_name, priceEntered) => {
      expect(inputError(() => calculatePriceSummary({ slotIds: SLOTS }, [{ slotId: 'top', priceEntered }], 1000))).toBe(
        'INVALID_PRICE',
      );
    });

    it('a non-number price', () => {
      const item = { slotId: 'top', priceEntered: '100' } as unknown as AttachedPrice;
      expect(inputError(() => calculatePriceSummary({ slotIds: SLOTS }, [item], 1000))).toBe('INVALID_PRICE');
    });
  });

  describe('rejects invalid budgets (profile budgetPreference)', () => {
    it.each([
      ['zero', 0],
      ['negative', -500],
      ['decimal', 1000.5],
      ['above ₹10,00,000', 1_000_001],
      ['NaN', Number.NaN],
    ])('%s', (_name, budget) => {
      expect(inputError(() => calculatePriceSummary({ slotIds: SLOTS }, [], budget))).toBe('INVALID_BUDGET');
    });
  });

  describe('rejects inconsistent slots (D-82)', () => {
    it('a look without slots', () => {
      expect(inputError(() => calculatePriceSummary({ slotIds: [] }, [], 1000))).toBe('INVALID_SLOTS');
    });

    it('a look that lists the same slotId twice', () => {
      expect(inputError(() => calculatePriceSummary({ slotIds: ['top', 'top'] }, [], 1000))).toBe('INVALID_SLOTS');
    });

    it('an item attached to a slot the look does not have', () => {
      const items = [{ slotId: 'jacket', priceEntered: 100 }];
      expect(inputError(() => calculatePriceSummary({ slotIds: SLOTS }, items, 1000))).toBe('UNKNOWN_SLOT');
    });

    it('two items on the same slot', () => {
      const items = [
        { slotId: 'top', priceEntered: 100 },
        { slotId: 'top', priceEntered: 200 },
      ];
      expect(inputError(() => calculatePriceSummary({ slotIds: SLOTS }, items, 1000))).toBe('DUPLICATE_SLOT_ITEM');
    });
  });
});

describe('filterByBudget', () => {
  const items = [
    { name: 'kurta', priceEntered: 1999 },
    { name: 'shoes', priceEntered: 2000 },
    { name: 'stole', priceEntered: 2000.01 },
  ];

  it('keeps items priced at or below the maximum (inclusive, like FR-BUD-03)', () => {
    expect(filterByBudget(items, 2000).map((i) => i.name)).toEqual(['kurta', 'shoes']);
  });

  it('keeps the original order and returns a new array', () => {
    const result = filterByBudget(items, 5000);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('returns nothing from an empty list', () => {
    expect(filterByBudget([], 1000)).toEqual([]);
  });

  it.each([0, -1, Number.NaN, 1_000_001])('rejects an invalid maximum (%s)', (max) => {
    expect(inputError(() => filterByBudget(items, max))).toBe('INVALID_BUDGET');
  });
});

describe('filterByCategory', () => {
  const items: Array<{ name: string; category: Category }> = [
    { name: 'kurta', category: 'kurta' },
    { name: 'jeans', category: 'jeans' },
    { name: 'second kurta', category: 'kurta' },
  ];

  it('keeps only items of the category, in order', () => {
    expect(filterByCategory(items, 'kurta').map((i) => i.name)).toEqual(['kurta', 'second kurta']);
  });

  it('returns nothing when no item matches', () => {
    expect(filterByCategory(items, 'saree')).toEqual([]);
  });
});

describe('formatInr', () => {
  it.each([
    [0, '₹0'],
    [2400, '₹2,400'],
    [100000, '₹1,00,000'],
    [1_000_000, '₹10,00,000'],
    [1999.5, '₹2,000'],
  ])('%s → %s (Indian grouping, whole rupees)', (amount, text) => {
    expect(formatInr(amount)).toBe(text);
  });

  it('formats a negative remainder', () => {
    expect(formatInr(-1500)).toBe('-₹1,500');
  });
});
