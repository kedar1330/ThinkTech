import {
  CATEGORIES,
  CATEGORY_GROUPS,
  type Category,
  type CategoryGroup,
  type LookSlot,
  type UserShortlistItem,
} from '@styleme/contracts';

// Filters for Shop My Look (#43). Shortlist items carry no category or size (FR-LIST-03), so category and
// size group narrow the look's slots, and the maximum price narrows the items offered for a slot.

export interface ShopFilters {
  category?: Category;
  group?: CategoryGroup;
  /** Whole or decimal rupees; items priced at or below it are offered (inclusive, like FR-BUD-03). */
  maxPrice?: number;
}

export const groupOf = (category: Category): CategoryGroup =>
  CATEGORIES.find((c) => c.id === category)?.group ?? 'freeSize';

export const categoryLabel = (category: Category) => CATEGORIES.find((c) => c.id === category)?.label ?? category;
export const groupLabel = (group: CategoryGroup) => CATEGORY_GROUPS.find((g) => g.id === group)?.label ?? group;

/** The categories and size groups present in a look, for the filter options, in vocabulary order. */
export function filterOptions(slots: readonly LookSlot[]): { categories: Category[]; groups: CategoryGroup[] } {
  const present = new Set(slots.map((s) => s.lookSpec.category));
  const categories = CATEGORIES.map((c) => c.id).filter((id) => present.has(id));
  const groups = CATEGORY_GROUPS.map((g) => g.id).filter((id) => categories.some((c) => groupOf(c) === id));
  return { categories, groups };
}

export function filterSlots(slots: readonly LookSlot[], filters: ShopFilters): LookSlot[] {
  return slots.filter(
    (s) =>
      (!filters.category || s.lookSpec.category === filters.category) &&
      (!filters.group || groupOf(s.lookSpec.category) === filters.group),
  );
}

/** Items that can go on a slot: unattached ones, within the maximum price, newest first as listed. */
export function pickableItems(items: readonly UserShortlistItem[], maxPrice?: number): UserShortlistItem[] {
  return items.filter((i) => i.outfitId === null && (maxPrice === undefined || i.priceEntered <= maxPrice));
}

/** A typed maximum price: a positive number, or no limit. */
export function parseMaxPrice(raw: string): number | undefined {
  const value = Number(raw.replace(/[,\s₹]/g, ''));
  return raw.trim() !== '' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** The "Shop this look" link (#43): `/shop?outfitId=<id>`, optionally `&slotId=<id>` for one part. */
export function shopHref(outfitId: string, slotId?: string): string {
  return `/shop?outfitId=${encodeURIComponent(outfitId)}${slotId ? `&slotId=${encodeURIComponent(slotId)}` : ''}`;
}
