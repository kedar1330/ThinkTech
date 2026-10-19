import {
  SHORTLIST_LIMITS,
  USER_ENTERED_LABELS,
  budgetPreferenceSchema,
  type Category,
  type UserPriceSummary,
} from '@styleme/contracts';

// Budget engine on user-entered prices (FR-BUD-01 … 03, FR-BUD-07). Pure code: no I/O, no AI, nothing
// stored. The Stage 1 summary uses only prices the user entered (`priceBasis: user_entered`); verified
// prices belong to the product layer and are never added to these totals (FR-BUD-02). Callers (#38,
// #43) validate requests with the contracts first, so an error here means inconsistent stored data.

/** A shortlist item attached to one slot of a saved look (`{ outfitId, slotId }`, D-82). */
export interface AttachedPrice {
  slotId: string;
  /** Rupees as the user entered them: > 0 and ≤ ₹10,00,000, at most two decimal places (D-80). */
  priceEntered: number;
}

/** The slots of a saved look, in any order. */
export interface LookSlots {
  slotIds: readonly string[];
}

export type BudgetInputErrorCode =
  'INVALID_PRICE' | 'INVALID_BUDGET' | 'INVALID_SLOTS' | 'UNKNOWN_SLOT' | 'DUPLICATE_SLOT_ITEM';

export class BudgetInputError extends Error {
  constructor(
    readonly code: BudgetInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BudgetInputError';
  }
}

/**
 * Price summary of a saved look (FR-BUD-07), computed on read. A slot is priced when an item is
 * attached to it; the look is complete only when every slot is priced. With a budget, the total is
 * within budget only if `itemsTotal <= budget`, and `budgetRemaining` is `budget − itemsTotal`, so it
 * is negative when over budget (FR-BUD-03). Without a budget only the total is reported (`no_budget`).
 */
export function calculatePriceSummary(
  look: LookSlots,
  items: readonly AttachedPrice[],
  budget?: number | null,
): UserPriceSummary {
  const slotIds = new Set(look.slotIds);
  if (slotIds.size === 0 || slotIds.size !== look.slotIds.length) {
    throw new BudgetInputError('INVALID_SLOTS', 'A look needs at least one slot and unique slot IDs');
  }
  const validBudget = budget === undefined || budget === null ? null : checkBudget(budget);

  const priced = new Set<string>();
  let totalPaise = 0;
  for (const item of items) {
    if (!slotIds.has(item.slotId)) {
      throw new BudgetInputError('UNKNOWN_SLOT', `The look has no slot "${item.slotId}"`);
    }
    if (priced.has(item.slotId)) {
      throw new BudgetInputError('DUPLICATE_SLOT_ITEM', `Slot "${item.slotId}" has more than one item (D-82)`);
    }
    priced.add(item.slotId);
    totalPaise += toPaise(item.priceEntered);
  }

  const itemsTotal = totalPaise / 100;
  const budgetRemaining = validBudget === null ? null : (validBudget * 100 - totalPaise) / 100;
  return {
    priceBasis: 'user_entered',
    itemsTotal,
    pricedSlots: priced.size,
    totalSlots: slotIds.size,
    complete: priced.size === slotIds.size,
    budget: validBudget,
    budgetRemaining,
    status: validBudget === null ? 'no_budget' : itemsTotal <= validBudget ? 'within_budget' : 'over_budget',
    label: USER_ENTERED_LABELS.total,
  };
}

/** Items priced at or below `max` rupees, in their original order (inclusive, like FR-BUD-03). */
export function filterByBudget<T extends { priceEntered: number }>(items: readonly T[], max: number): T[] {
  const limit = checkBudget(max);
  return items.filter((item) => item.priceEntered <= limit);
}

/** Items of one vocabulary category, in their original order. */
export function filterByCategory<T extends { category: Category }>(items: readonly T[], category: Category): T[] {
  return items.filter((item) => item.category === category);
}

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Whole rupees with Indian digit grouping, e.g. 100000 → "₹1,00,000". */
export function formatInr(amount: number): string {
  return INR.format(amount);
}

function toPaise(price: unknown): number {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price > SHORTLIST_LIMITS.priceMax) {
    throw new BudgetInputError('INVALID_PRICE', `A price must be more than ₹0 and at most ₹10,00,000 (D-80)`);
  }
  const paise = Math.round(price * 100);
  if (Math.abs(price * 100 - paise) > 1e-6) {
    throw new BudgetInputError('INVALID_PRICE', 'A price has at most two decimal places');
  }
  return paise;
}

/** Budgets are whole rupees, > 0 and ≤ ₹10,00,000, as in the profile (`budgetPreference`). */
function checkBudget(budget: number): number {
  if (!budgetPreferenceSchema.safeParse(budget).success) {
    throw new BudgetInputError('INVALID_BUDGET', 'A budget must be whole rupees, more than ₹0 and at most ₹10,00,000');
  }
  return budget;
}
