// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRICE_RANGE_LABEL, type Look, type LookPriceRange, type LookSlot } from '@styleme/contracts';
import { TabPhoto } from '@/components/shop/TabPhoto';
import { TabPriceRange } from '@/components/shop/TabPriceRange';

// The outfit photo and the price range on each Shop My Look tab (#118). Prices are synthetic.

const ID = 'b'.repeat(24);

const slot = (slotId: string, kind: LookSlot['slot'], name: string, hex: string): LookSlot => ({
  slotId,
  slot: kind,
  lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name, hex }],
  searchPhrase: `${name.toLowerCase()} kurta`,
  sizeNote: 'Add your size',
  alternatives: [],
});

const look = (overrides: Partial<Look> = {}): Look => ({
  id: ID,
  status: 'saved',
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: [
    slot('top', 'top', 'Navy', '#1F2A44'),
    slot('bottom', 'bottom', 'Cream', '#F3E9D2'),
    slot('shoes', 'footwear', 'Tan', '#A0522D'),
  ],
  explanation: 'Synthetic.',
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: 'sig',
  aiModel: null,
  source: 'discover_my_style',
  ...overrides,
});

const range = (overrides: Partial<LookPriceRange> = {}): LookPriceRange => ({
  currency: 'INR',
  priceBasis: 'search_results',
  min: 898,
  max: 2598,
  pricedSlots: 2,
  totalSlots: 2,
  slots: [
    { slotId: 'top', min: 449, max: 1299, listings: 3, stores: ['amazon', 'flipkart', 'meesho'] },
    { slotId: 'bottom', min: 449, max: 1299, listings: 2, stores: ['amazon', 'meesho'] },
  ],
  stores: ['amazon', 'flipkart', 'meesho'],
  checkedAt: '2026-10-23T05:30:00.000Z',
  label: PRICE_RANGE_LABEL,
  ...overrides,
});

const replyWith = (res: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('outfit photo on a tab', () => {
  it('shows the stored outfit image through our own route, loaded lazily', () => {
    render(<TabPhoto look={look({ image: 'ready' })} title="Everyday look" />);
    const img = screen.getByRole('img', { name: 'AI-generated picture of the outfit: Everyday look' });
    expect(img).toHaveAttribute('src', `/api/outfits/${ID}/image`);
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('falls back to the garment colours when images are off or the image fails, never a made-up photo', () => {
    const { rerender } = render(<TabPhoto look={look()} title="Everyday look" />);
    expect(screen.getByRole('img', { name: 'Colours of this outfit: Navy, Cream' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /AI-generated/ })).toBeNull();

    rerender(<TabPhoto look={look({ image: 'on_request' })} title="Everyday look" />);
    fireEvent.error(screen.getByRole('img', { name: /AI-generated/ }));
    expect(screen.getByTestId('tab-photo-fallback')).toBeInTheDocument();
  });
});

describe('price range on a tab', () => {
  it('shows the range from store listings with the stores, the time checked and the label', async () => {
    replyWith(Response.json(range()));
    render(<TabPriceRange outfitId={ID} />);
    expect(screen.getByText('Checking prices…')).toBeInTheDocument();
    const box = screen.getByTestId('tab-price-range');
    expect(await screen.findByText(/₹898 – ₹2,598/)).toBeInTheDocument();
    expect(box).toHaveTextContent('for this look');
    expect(box).toHaveTextContent('On Amazon, Flipkart, Meesho · checked');
    expect(box).toHaveTextContent(PRICE_RANGE_LABEL);
    expect(fetch).toHaveBeenCalledWith(`/api/outfits/${ID}/price-range`, { cache: 'no-store' });
  });

  it('says how many pieces the range covers when some garments had no listings', async () => {
    replyWith(
      Response.json(
        range({
          min: 449,
          max: 1299,
          pricedSlots: 1,
          slots: [
            { slotId: 'top', min: 449, max: 1299, listings: 3, stores: ['amazon'] },
            { slotId: 'bottom', min: null, max: null, listings: 0, stores: [] },
          ],
          stores: ['amazon'],
        }),
      ),
    );
    render(<TabPriceRange outfitId={ID} />);
    expect(await screen.findByText(/for 1 of 2 pieces/)).toBeInTheDocument();
    expect(screen.getByTestId('tab-price-range')).toHaveTextContent('On Amazon ·');
  });

  it('never guesses: no listings, an error or a malformed reply show no price', async () => {
    replyWith(
      Response.json(
        range({
          min: null,
          max: null,
          pricedSlots: 0,
          stores: [],
          slots: [{ slotId: 'top', min: null, max: null, listings: 0, stores: [] }],
        }),
      ),
    );
    const { unmount } = render(<TabPriceRange outfitId={ID} />);
    expect(await screen.findByText('No prices found on Amazon, Flipkart or Meesho')).toBeInTheDocument();
    unmount();

    for (const res of [
      Response.json({ error: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 }),
      Response.json({ min: 1, max: 2 }),
    ]) {
      replyWith(res);
      const view = render(<TabPriceRange outfitId={ID} />);
      expect(await screen.findByText('Price range unavailable')).toBeInTheDocument();
      expect(screen.getByTestId('tab-price-range')).not.toHaveTextContent('₹');
      view.unmount();
    }
  });
});
