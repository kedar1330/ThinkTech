import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, fitCount, isActive } from '@/components/app/TopNav';

describe('top navigation overflow', () => {
  const widths = [80, 170, 180, 170, 150];
  it('shows every item when they all fit, without a More button', () => {
    expect(fitCount(widths, 750, 90, 0)).toBe(5);
  });
  it('moves the items that do not fit into More, keeping room for the More button', () => {
    // 80 + 170 + 180 = 430, plus More 90 = 520 ≤ 600; adding the next item would not fit.
    expect(fitCount(widths, 600, 90, 0)).toBe(3);
    expect(fitCount(widths, 300, 90, 0)).toBe(1);
  });
  it('can show none inline when even the first item and More do not fit', () => {
    expect(fitCount(widths, 120, 90, 0)).toBe(0);
  });
});

describe('navigation items', () => {
  it('has all nine sections with Home and Discover My Style first', () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      'Home',
      'Discover My Style',
      'My Colour Palette',
      'Outfit Categories',
      'Shop My Look',
      'Virtual Try-On',
      'Design Studio',
      'Style Assistant',
      'Saved Outfits',
    ]);
    // Nothing is Coming soon: Design Studio (D-134), Style Assistant (D-136) and Virtual Try-On (D-137) are live.
    expect(NAV_ITEMS.filter((i) => i.soon)).toHaveLength(0);
  });
  it('matches the active route without false prefixes', () => {
    expect(isActive('/home', '/home')).toBe(true);
    expect(isActive('/profile', '/profile')).toBe(true);
    expect(isActive('/features/design-studio', '/features/design-studio')).toBe(true);
    expect(isActive('/profile-other', '/profile')).toBe(false);
    expect(isActive('/home/x', '/home')).toBe(false);
  });
});
