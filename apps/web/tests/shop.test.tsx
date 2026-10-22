// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  USER_ENTERED_LABELS,
  type LookSlot,
  type OutfitDetail,
  type ProfileSizes,
  type UserPriceSummary,
  type UserShortlistItem,
} from '@styleme/contracts';

const shop = vi.hoisted(() => ({ attachItemAction: vi.fn(), detachItemAction: vi.fn() }));
vi.mock('@/app/actions/shop', () => shop);
vi.mock('@/app/actions/outfits', () => ({
  saveOutfitAction: vi.fn(),
  shopLookAction: vi.fn(),
  removeOutfitAction: vi.fn(),
}));

import { LookShopper } from '@/components/shop/LookShopper';

// Shop My Look for one saved look (#43): parts, attached items, the picker, filters and the summary.

const LOOK_ID = 'c'.repeat(24);
const SIZES: ProfileSizes = { tops: null, bottoms: { waistIn: 32 }, ethnicTops: null, ethnicSets: null, shoes: null };

const slot = (slotId: string, category: LookSlot['lookSpec']['category']): LookSlot => ({
  slotId,
  slot: 'top',
  lookSpec: { category, colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
  searchPhrase: `navy ${category}`,
  sizeNote: 'Add your size',
  alternatives: [],
});

const item = (id: string, name: string, priceEntered: number, slotId: string | null = null): UserShortlistItem => ({
  id: id.padStart(24, '0'),
  name,
  priceEntered,
  currency: 'INR',
  priceBasis: 'user_entered',
  verifiedByStyleMe: false,
  url: slotId ? 'https://shop.example/kurta?ref=friend' : null,
  note: null,
  outfitId: slotId ? LOOK_ID : null,
  slotId,
  createdAt: '2026-10-20T00:00:00.000Z',
});

const KURTA = item('1', 'Indigo kurta', 1299.5, 'top');
const TROUSERS = item('2', 'Cream trousers', 1800);
const SCARF = item('3', 'Silk scarf', 450);

const summary = (overrides: Partial<UserPriceSummary> = {}): UserPriceSummary => ({
  priceBasis: 'user_entered',
  itemsTotal: 1299.5,
  pricedSlots: 1,
  totalSlots: 3,
  complete: false,
  budget: null,
  budgetRemaining: null,
  status: 'no_budget',
  label: USER_ENTERED_LABELS.total,
  ...overrides,
});

function look(overrides: Partial<OutfitDetail> = {}): OutfitDetail {
  return {
    id: LOOK_ID,
    status: 'saved',
    templateId: 'OUT-001',
    paletteId: 'PAL-001',
    slots: [slot('top', 'kurta'), slot('bottom', 'trousers'), slot('accessory-1', 'accessory')],
    explanation: 'Synthetic.',
    explanationRefs: { ruleIds: [], attributes: [] },
    combinationSignature: 'sig',
    aiModel: null,
    request: { occasion: 'work', paletteMode: 'suggested' },
    inputsUsed: {
      department: 'women',
      departmentFiltered: true,
      likedColors: [],
      dislikedColors: [],
      contrastPreference: null,
      silhouettePreferences: [],
      fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
      coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
      fabricPreferences: { liked: [], avoided: [] },
      preferredStyles: [],
      sizesSaved: ['bottoms'],
      signalsUsed: false,
    },
    userItems: [KURTA],
    priceSummary: summary(),
    ...overrides,
  };
}

const parts = () => within(screen.getByRole('list', { name: 'Parts of this look' })).getAllByRole('heading');

beforeEach(() => {
  shop.attachItemAction.mockReset();
  shop.detachItemAction.mockReset();
});

describe('Shop My Look for a saved look', () => {
  it('shows each part with its size, the attached item with its labels, and a plain outbound link', () => {
    render(<LookShopper look={look()} items={[KURTA, TROUSERS, SCARF]} sizes={SIZES} />);
    expect(parts().map((h) => h.textContent)).toEqual(['Kurta', 'Trousers', 'Accessory']);

    const top = screen.getByText('Indigo kurta').closest('li')!;
    expect(top).toHaveTextContent(USER_ENTERED_LABELS.item);
    expect(top).toHaveTextContent('₹1,299.50');
    expect(top).toHaveTextContent(USER_ENTERED_LABELS.price);
    const link = within(top).getByRole('link', { name: /shop\.example/ });
    expect(link).toHaveAttribute('href', 'https://shop.example/kurta?ref=friend');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(link).toHaveAttribute('target', '_blank');

    const bottom = screen.getByRole('heading', { name: 'Trousers' }).closest('li')!;
    expect(bottom).toHaveTextContent('Your saved size: Waist 32 in');
  });

  it('shows the labelled total, priced parts and the budget status', () => {
    const { rerender } = render(<LookShopper look={look()} items={[]} sizes={SIZES} />);
    const box = screen.getByRole('group', { name: 'Price summary' });
    expect(box).toHaveTextContent('Total so far: ₹1,299.50');
    expect(box).toHaveTextContent(USER_ENTERED_LABELS.total);
    expect(box).toHaveTextContent('1 of 3 parts priced');
    expect(within(box).getByRole('link', { name: 'Add one in your profile' })).toBeInTheDocument();

    rerender(
      <LookShopper
        look={look({ priceSummary: summary({ budget: 2000, budgetRemaining: 700.5, status: 'within_budget' }) })}
        items={[]}
        sizes={SIZES}
      />,
    );
    expect(screen.getByRole('group', { name: 'Price summary' })).toHaveTextContent(
      'Within your ₹2,000 budget per look: ₹700.50 left.',
    );
    rerender(
      <LookShopper
        look={look({ priceSummary: summary({ budget: 1000, budgetRemaining: -299.5, status: 'over_budget' }) })}
        items={[]}
        sizes={SIZES}
      />,
    );
    expect(screen.getByRole('group', { name: 'Price summary' })).toHaveTextContent(
      'Over your ₹1,000 budget per look by ₹299.50.',
    );
    rerender(<LookShopper look={look({ userItems: [], priceSummary: undefined })} items={[]} sizes={SIZES} />);
    expect(screen.getByText(/Add items from your shortlist to the parts below/)).toBeInTheDocument();
  });

  it('adds a chosen shortlist item to a part', async () => {
    shop.attachItemAction.mockResolvedValue({ success: 'Added to the look.' });
    const user = userEvent.setup();
    render(<LookShopper look={look()} items={[KURTA, TROUSERS, SCARF]} sizes={SIZES} />);
    // Attached items aren't offered again.
    const picker = screen.getByLabelText('Add an item from your shortlist for trousers');
    expect(
      within(picker)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose an item', 'Cream trousers — ₹1,800', 'Silk scarf — ₹450']);
    await user.selectOptions(picker, TROUSERS.id);
    await user.click(within(picker.closest('form')!).getByRole('button', { name: 'Add to look' }));

    const form = shop.attachItemAction.mock.calls[0]![1] as FormData;
    expect(Object.fromEntries(form)).toEqual({ outfitId: LOOK_ID, slotId: 'bottom', itemId: TROUSERS.id });
  });

  it('takes an item off a part', async () => {
    shop.detachItemAction.mockResolvedValue({ success: 'Taken off the look.' });
    const user = userEvent.setup();
    render(<LookShopper look={look()} items={[KURTA]} sizes={SIZES} />);
    await user.click(screen.getByRole('button', { name: 'Take Indigo kurta off Kurta' }));
    expect((shop.detachItemAction.mock.calls[0]![1] as FormData).get('itemId')).toBe(KURTA.id);
  });

  it('shows the API error from attaching', async () => {
    shop.attachItemAction.mockResolvedValue({ error: 'That part of the look already has an item.' });
    const user = userEvent.setup();
    render(<LookShopper look={look()} items={[KURTA, TROUSERS]} sizes={SIZES} />);
    const picker = screen.getByLabelText('Add an item from your shortlist for trousers');
    await user.selectOptions(picker, TROUSERS.id);
    await user.click(within(picker.closest('form')!).getByRole('button', { name: 'Add to look' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That part of the look already has an item.');
  });

  it('filters parts by category and size, and items by price', async () => {
    const user = userEvent.setup();
    render(<LookShopper look={look()} items={[KURTA, TROUSERS, SCARF]} sizes={SIZES} />);

    await user.selectOptions(screen.getByLabelText('Category'), 'trousers');
    expect(parts().map((h) => h.textContent)).toEqual(['Trousers']);
    await user.selectOptions(screen.getByLabelText('Category'), '');
    await user.selectOptions(screen.getByLabelText('Size'), 'freeSize');
    expect(parts().map((h) => h.textContent)).toEqual(['Accessory']);

    await user.type(screen.getByLabelText('Items up to (₹)'), '500');
    const picker = screen.getByLabelText('Add an item from your shortlist for accessory');
    expect(
      within(picker)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose an item', 'Silk scarf — ₹450']);

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(parts()).toHaveLength(3);
  });

  it('says when no part matches, and when no item matches the price', async () => {
    const user = userEvent.setup();
    render(<LookShopper look={look()} items={[TROUSERS]} sizes={SIZES} />);
    await user.type(screen.getByLabelText('Items up to (₹)'), '100');
    expect(screen.getAllByText(/None of your unattached shortlist items are within this price/).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('link', { name: 'Add an item you found' })[0]).toHaveAttribute('href', '/shortlist');
  });

  it('says when the shortlist has nothing to add yet', () => {
    render(<LookShopper look={look()} items={[KURTA]} sizes={SIZES} />);
    expect(screen.getAllByText(/Your shortlist has no items to add yet/)).toHaveLength(2);
  });

  it('highlights the part named in the link', () => {
    render(<LookShopper look={look()} items={[]} sizes={SIZES} focusSlotId="accessory-1" />);
    const focused = screen.getByRole('heading', { name: 'Accessory' }).closest('[aria-current]');
    expect(focused).toHaveAttribute('aria-current', 'true');
  });
});
