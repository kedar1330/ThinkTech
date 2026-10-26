'use client';

import { useState } from 'react';
import type { OutfitDetail, ProfileSizes, UserShortlistItem } from '@styleme/contracts';
import { filterOptions, filterSlots, groupLabel, groupOf, parseMaxPrice, pickableItems } from '@/lib/shop/look-shopper';
import { SizeNote } from '@/components/outfits/SizeNote';
import { SwatchList } from '@/components/outfits/SwatchList';
import { slotGarmentName } from '@/lib/outfits/look-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PriceSummary } from './PriceSummary';
import { ShopFilters, type ShopFilterValues } from './ShopFilters';
import { SlotItemPicker } from './SlotItemPicker';

/**
 * Shop My Look for one saved look (#43): each part with the user's saved size and the item they put on
 * it, or a picker over their shortlist; the price summary; filters by category, size and price.
 */
export function LookShopper({
  look,
  items,
  sizes,
  focusSlotId,
  excludeAccessories = false,
}: {
  look: OutfitDetail;
  items: readonly UserShortlistItem[];
  sizes: ProfileSizes;
  /** From `/shop?outfitId=…&slotId=…`: the part to highlight. */
  focusSlotId?: string;
  /** When true, excludes shoes and accessories to focus on clothing pieces only. */
  excludeAccessories?: boolean;
}) {
  const [values, setValues] = useState<ShopFilterValues>({ priceText: '' });
  // Exclude shoes and accessories when requested
  const mainSlots = excludeAccessories
    ? look.slots.filter(
        (s) =>
          s.lookSpec.category !== 'shoes' &&
          s.lookSpec.category !== 'accessory' &&
          s.slot !== 'footwear' &&
          s.slot !== 'accessory',
      )
    : look.slots;
  const options = filterOptions(mainSlots);
  const slots = filterSlots(mainSlots, values);
  const offered = pickableItems(items, parseMaxPrice(values.priceText));
  const filtered = offered.length < pickableItems(items).length;

  return (
    <div className="space-y-6">
      <Card className="p-4 sm:p-6">
        <PriceSummary summary={look.priceSummary} />
      </Card>

      <ShopFilters categories={options.categories} groups={options.groups} value={values} onChange={setValues} />

      {slots.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm">No parts of this look match these filters.</p>
          <Button type="button" variant="outline" onClick={() => setValues({ priceText: '' })}>
            Clear filters
          </Button>
        </div>
      ) : (
        <ul aria-label="Parts of this look" className="grid gap-4 sm:grid-cols-2">
          {slots.map((slot) => {
            const name = slotGarmentName(slot);
            return (
              <li key={slot.slotId} id={`slot-${slot.slotId}`} className="scroll-mt-20">
                <Card
                  className={cn(
                    'h-full space-y-3 p-4 sm:p-5',
                    slot.slotId === focusSlotId && 'border-plum ring-2 ring-plum/30',
                  )}
                  aria-current={slot.slotId === focusSlotId ? 'true' : undefined}
                >
                  <div className="space-y-0.5">
                    <h3 className="font-medium">{name}</h3>
                    <p className="text-xs text-muted-foreground">Size: {groupLabel(groupOf(slot.lookSpec.category))}</p>
                  </div>
                  <SwatchList swatches={slot.swatches} />
                  <SizeNote category={slot.lookSpec.category} sizes={sizes} />
                  <SlotItemPicker
                    outfitId={look.id}
                    slotId={slot.slotId}
                    partName={name}
                    attached={look.userItems.find((i) => i.slotId === slot.slotId)}
                    items={offered}
                    filtered={filtered}
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
