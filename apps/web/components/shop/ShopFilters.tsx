'use client';

import type { Category, CategoryGroup } from '@styleme/contracts';
import { categoryLabel, groupLabel } from '@/lib/shop/look-shopper';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const control =
  'flex h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30';

/** What the filter controls hold; the maximum price stays as typed so the box never jumps. */
export interface ShopFilterValues {
  category?: Category;
  group?: CategoryGroup;
  priceText: string;
}

/** Category and size group narrow the look's parts; the maximum price narrows the items offered (#43). */
export function ShopFilters({
  categories,
  groups,
  value,
  onChange,
}: {
  categories: readonly Category[];
  groups: readonly CategoryGroup[];
  value: ShopFilterValues;
  onChange: (values: ShopFilterValues) => void;
}) {
  const active = Boolean(value.category || value.group || value.priceText.trim());
  return (
    <fieldset className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
      <legend className="sr-only">Filters</legend>
      <div className="space-y-1.5">
        <Label htmlFor="shop-category">Category</Label>
        <select
          id="shop-category"
          className={control}
          value={value.category ?? ''}
          onChange={(e) => onChange({ ...value, category: (e.target.value || undefined) as Category | undefined })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(c)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shop-size">Size</Label>
        <select
          id="shop-size"
          className={control}
          value={value.group ?? ''}
          onChange={(e) => onChange({ ...value, group: (e.target.value || undefined) as CategoryGroup | undefined })}
        >
          <option value="">All sizes</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {groupLabel(g)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="shop-max-price">Items up to (₹)</Label>
        <input
          id="shop-max-price"
          inputMode="decimal"
          placeholder="Any price"
          className={control}
          value={value.priceText}
          onChange={(e) => onChange({ ...value, priceText: e.target.value })}
        />
      </div>
      <Button type="button" variant="outline" disabled={!active} onClick={() => onChange({ priceText: '' })}>
        Clear filters
      </Button>
    </fieldset>
  );
}
