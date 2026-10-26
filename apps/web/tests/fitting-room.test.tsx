// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_MATCHES_LABEL,
  type LookProductMatches,
  type LookSlot,
  type ProductListing,
  type TryOnOverview,
} from '@styleme/contracts';
import type { WornItem } from '@/lib/try-on/garments';

// The 3D view needs WebGL: a stand-in lists what the mannequin wears. The AI panel and colour reading are
// stubbed too; their own tests cover them.
vi.mock('@/components/try-on/Mannequin3D', () => ({
  Mannequin3D: ({ outfit }: { outfit: readonly WornItem[] }) => (
    <ul aria-label="Mannequin wears">
      {outfit.map((w) => (
        <li key={w.slotId} data-colour={w.colour}>
          {w.listing.title}
        </li>
      ))}
    </ul>
  ),
}));
const studio = vi.hoisted(() => vi.fn());
vi.mock('@/components/try-on/TryOnStudio', () => ({
  TryOnStudio: (props: { items: unknown }) => {
    studio(props);
    return <p>AI try-on panel</p>;
  },
}));
vi.mock('@/lib/try-on/colour', () => ({ itemColour: vi.fn(async () => '#123456') }));
const cartoon = vi.hoisted(() => vi.fn());
vi.mock('@/components/try-on/ModelViews', () => ({
  ModelViews: (props: { items: unknown }) => {
    cartoon(props);
    return <p>Model view</p>;
  },
}));

import { FittingRoom } from '@/components/try-on/FittingRoom';

const ID = 'b'.repeat(24);
const READY: TryOnOverview = { available: true, drapeAvailable: false, tryOnModel: 'custom_photo', hasPhoto: true };

const slot = (slotId: string, kind: LookSlot['slot'], category: LookSlot['lookSpec']['category']): LookSlot => ({
  slotId,
  slot: kind,
  lookSpec: { category, colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
  searchPhrase: `navy ${category}`,
  sizeNote: 'Add your size',
  alternatives: [],
});
const look = { id: ID, slots: [slot('top', 'top', 'kurta'), slot('bottom', 'bottom', 'trousers')] };

const listing = (store: ProductListing['store'], title: string, price: number): ProductListing => ({
  store,
  title,
  price,
  link: 'https://www.google.com/search?ibp=oshop&q=synthetic',
  imageUrl: `https://encrypted-tbn0.gstatic.com/shopping?q=tbn:${encodeURIComponent(title)}`,
});
const match = (store: ProductListing['store'], title: string, price: number) => ({
  ...listing(store, title, price),
  matched: [],
});
const matches: LookProductMatches = {
  currency: 'INR',
  priceBasis: 'search_results',
  slots: [
    {
      slotId: 'top',
      listings: [match('meesho', 'Kurta M', 299), match('amazon', 'Kurta A', 699)],
      // Another style of the same garment (#133): listed after the matches, and it can be worn too.
      alternatives: [listing('flipkart', 'Kurta Printed', 349)],
      stats: [],
    },
    { slotId: 'bottom', listings: [match('flipkart', 'Trousers F', 499)], alternatives: [], stats: [] },
  ],
  checkedAt: '2026-10-23T10:00:00.000Z',
  label: PRODUCT_MATCHES_LABEL,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(matches)),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const room = (start: { slotId?: string; item?: { store: 'amazon'; title: string; price: number } } = {}) =>
  render(<FittingRoom look={look} department="women" bodyType={null} picks={[]} start={start} overview={READY} />);
const wears = async () =>
  within(await screen.findByRole('list', { name: 'Mannequin wears' })).queryAllByRole('listitem');

describe('FittingRoom (D-137)', () => {
  it('dresses the mannequin in the item clicked in Shop My Look', async () => {
    room({ slotId: 'top', item: { store: 'amazon', title: 'Kurta A', price: 699 } });
    expect(await screen.findByRole('button', { name: /Kurta A/, pressed: true })).toBeInTheDocument();
    expect((await wears()).map((li) => li.textContent)).toEqual(['Kurta A']);
    expect(fetch).toHaveBeenCalledWith(`/api/outfits/${ID}/products`, { cache: 'no-store' });
  });

  it('opened from a look, puts the original look on first and allows switching to recommendations', async () => {
    room();
    expect(await screen.findByRole('button', { name: /Original Navy Kurta/, pressed: true })).toBeInTheDocument();
    expect((await wears()).map((li) => li.textContent).sort()).toEqual(['Original Navy Kurta', 'Original Navy Trousers']);

    // Clicking a recommendation swaps to that store item
    await userEvent.click(await screen.findByRole('button', { name: /Kurta M/, pressed: false }));
    expect((await wears()).map((li) => li.textContent).sort()).toEqual(['Kurta M', 'Original Navy Trousers']);

    await userEvent.click(screen.getByRole('tab', { name: 'Trousers' }));
    await userEvent.click(await screen.findByRole('button', { name: /Trousers F/, pressed: false }));
    expect((await wears()).map((li) => li.textContent).sort()).toEqual(['Kurta M', 'Trousers F']);
    expect(screen.getByText('₹798', { exact: false })).toBeInTheDocument();
  });

  it('swaps an item for the same part, takes items off, and resets', async () => {
    room({ slotId: 'top', item: { store: 'amazon', title: 'Kurta A', price: 699 } });
    await userEvent.click(await screen.findByRole('button', { name: /Kurta M/, pressed: false }));
    expect((await wears()).map((li) => li.textContent)).toEqual(['Kurta M']);
    // Other styles are listed after the matches and can be worn as well.
    const tops = within(screen.getByRole('list', { name: 'Kurta items' })).getAllByRole('button');
    expect(tops.map((b) => b.textContent?.match(/Kurta \w+/)?.[0]).filter(Boolean)).toEqual(['Kurta M', 'Kurta A', 'Kurta Printed']);
    await userEvent.click(screen.getByRole('button', { name: /Kurta Printed/ }));
    expect((await wears()).map((li) => li.textContent)).toEqual(['Kurta Printed']);
    await userEvent.click(screen.getByRole('button', { name: /Kurta M/, pressed: false }));

    await userEvent.click(screen.getByRole('tab', { name: 'Trousers' }));
    await userEvent.click(screen.getByRole('button', { name: /Trousers F/ }));
    expect((await wears()).map((li) => li.textContent)).toEqual(['Kurta M', 'Trousers F']);

    await userEvent.click(screen.getByRole('button', { name: 'Take off Kurta M' }));
    expect((await wears()).map((li) => li.textContent)).toEqual(['Trousers F']);
    // Clicking a worn item takes it off too.
    await userEvent.click(screen.getByRole('button', { name: /Trousers F/, pressed: true }));
    expect(await wears()).toHaveLength(0);
    expect(screen.getByText(/Pick an item on the left/)).toBeInTheDocument();
  });

  it('colours each garment from its picture', async () => {
    room({ slotId: 'top', item: { store: 'amazon', title: 'Kurta A', price: 699 } });
    await vi.waitFor(async () => expect((await wears())[0]).toHaveAttribute('data-colour', '#123456'));
  });

  it('“Make it realistic” tries the same outfit on with AI', async () => {
    room();
    await screen.findByRole('button', { name: /Original Navy Kurta/, pressed: true });
    await userEvent.click(await screen.findByRole('button', { name: /Kurta M/, pressed: false }));
    await userEvent.click(screen.getByRole('tab', { name: 'Trousers' }));
    await userEvent.click(await screen.findByRole('button', { name: /Trousers F/, pressed: false }));
    await userEvent.click(screen.getByRole('button', { name: /Make it realistic with AI/ }));
    expect(screen.getByText('AI try-on panel')).toBeInTheDocument();
    expect(studio).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outfitId: ID,
        items: [
          expect.objectContaining({ slotId: 'bottom', store: 'flipkart', title: 'Trousers F', price: 499 }),
          expect.objectContaining({ slotId: 'top', store: 'meesho', title: 'Kurta M', price: 299 }),
        ],
      }),
    );
  });

  it('shows the model first when it can be dressed, wearing the outfit; the 3D mannequin is a tab', async () => {
    render(
      <FittingRoom
        look={look}
        department="women"
        bodyType={null}
        picks={[]}
        start={{ slotId: 'top', item: { store: 'amazon', title: 'Kurta A', price: 699 } }}
        overview={{ ...READY, drapeAvailable: true }}
      />,
    );
    await screen.findByRole('button', { name: /Kurta A/, pressed: true });
    expect(screen.getByText('Model view')).toBeInTheDocument();
    expect(cartoon).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outfitId: ID,
        department: 'women',
        items: [
          expect.objectContaining({
            slotId: 'top',
            store: 'amazon',
            title: 'Kurta A',
            price: 699,
          }),
        ],
      }),
    );
    await userEvent.click(screen.getByRole('tab', { name: '3D mannequin' }));
    expect(screen.queryByText('Model view')).toBeNull();
    expect(screen.getByRole('list', { name: 'Mannequin wears' })).toBeInTheDocument();
  });

  it('says so when the clothes can’t be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    room();
    expect(await screen.findByText(/clothes for this look couldn’t be loaded/)).toBeInTheDocument();
  });
});
