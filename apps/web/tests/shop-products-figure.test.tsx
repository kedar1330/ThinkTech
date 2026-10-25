// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_MATCHES_LABEL,
  type Look,
  type LookProductMatches,
  type LookSlot,
  type MatchedListing,
  type ProductListing,
} from '@styleme/contracts';
const shopActions = vi.hoisted(() => ({
  pickProductAction: vi.fn(),
  unpickProductAction: vi.fn(),
  attachItemAction: vi.fn(),
  detachItemAction: vi.fn(),
}));
vi.mock('@/app/actions/shop', () => shopActions);

import { BodyTypeFigure, FIGURE_LABEL } from '@/components/shop/BodyTypeFigure';
import { ProductMatches } from '@/components/shop/ProductMatches';

// Shop My Look (#120): similar products with price comparison, and the look on a body-type figure (D-119).
// Listings are synthetic.

const ID = 'c'.repeat(24);

const slot = (
  slotId: string,
  kind: LookSlot['slot'],
  category: LookSlot['lookSpec']['category'],
  name: string,
  hex: string,
): LookSlot => ({
  slotId,
  slot: kind,
  lookSpec: { category, colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name, hex }],
  searchPhrase: `${name.toLowerCase()} ${category}`,
  sizeNote: 'Add your size',
  alternatives: [],
});

const look: Pick<Look, 'id' | 'slots'> = {
  id: ID,
  slots: [
    slot('top', 'top', 'kurta', 'Navy', '#1F2A44'),
    slot('bottom', 'bottom', 'trousers', 'Cream', '#F3E9D2'),
    slot('shoes', 'footwear', 'shoes', 'Tan', '#A0522D'),
  ],
};

const item = (store: ProductListing['store'], title: string, price: number): ProductListing => ({
  store,
  title,
  price,
  link: 'https://www.google.com/search?ibp=oshop&q=synthetic',
  imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:synthetic',
});

/** A match whose title mentions these of the look's attributes (#133). */
const matchOf = (l: ProductListing, matched: MatchedListing['matched'] = ['category']): MatchedListing => ({
  ...l,
  matched,
});

const matches: LookProductMatches = {
  currency: 'INR',
  priceBasis: 'search_results',
  slots: [
    {
      slotId: 'top',
      listings: [matchOf(item('meesho', 'Synthetic kurta M', 299)), matchOf(item('amazon', 'Synthetic kurta A', 699))],
      alternatives: [],
      stats: [
        { store: 'amazon', listings: 1, min: 699, median: 699, max: 699 },
        { store: 'meesho', listings: 1, min: 299, median: 299, max: 299 },
      ],
    },
    {
      slotId: 'bottom',
      listings: [matchOf(item('flipkart', 'Synthetic trousers F', 499))],
      alternatives: [],
      stats: [{ store: 'flipkart', listings: 1, min: 499, median: 499, max: 499 }],
    },
  ],
  checkedAt: '2026-10-23T05:30:00.000Z',
  label: PRODUCT_MATCHES_LABEL,
};

const replyWith = (res: Response) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => res),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  shopActions.pickProductAction.mockReset();
  shopActions.unpickProductAction.mockReset();
});

const asPick = (slotId: string, l: ProductListing) => ({ ...l, slotId, pickedAt: '2026-10-23T05:30:00.000Z' });

/** Clicks an item to open its options (#125) and returns them. */
async function openOptions(title: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(title) }));
  return screen.getByRole('group', { name: `Options for ${title}` });
}

describe('similar products to compare', () => {
  it('lists each garment’s items with the store’s title, price, thumbnail and Google Shopping link, with the label', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    expect(await screen.findByRole('heading', { name: 'Similar items to compare' })).toBeInTheDocument();
    expect(screen.getByText(PRODUCT_MATCHES_LABEL)).toBeInTheDocument();

    const kurta = screen.getByRole('region', { name: /^Kurta/ });
    const card = within(kurta).getByText('Synthetic kurta M').closest('li')!;
    // The store is a label on the picture; the price is under the title.
    expect(within(card).getByText('Meesho')).toBeInTheDocument();
    expect(within(card).getByText('₹299')).toBeInTheDocument();
    expect(within(kurta).getByRole('list', { name: 'Prices by store for Kurta' })).toHaveTextContent(
      'Amazon: 1 found, ₹699 – ₹699 (typical ₹699)',
    );
    const options = await openOptions('Synthetic kurta M');
    // #134: the store's own search for the title, and Google Shopping only as a secondary link.
    const store = within(options).getByRole('link', {
      name: 'Search for Synthetic kurta M on Meesho (opens in a new tab)',
    });
    expect(store).toHaveAttribute('href', 'https://www.meesho.com/search?q=Synthetic%20kurta%20M');
    expect(store).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(store).toHaveAttribute('target', '_blank');
    expect(store).toHaveTextContent('View on Meesho');
    const google = within(options).getByRole('link', { name: 'Google Shopping' });
    expect(google).toHaveAttribute('href', 'https://www.google.com/search?ibp=oshop&q=synthetic');
    expect(kurta.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('group', { name: 'Compare totals' })).toHaveTextContent(
      'Cheapest found for this look: ₹798',
    );
  });

  it('#133 shows matches first with what they match, then other styles of the same garment', async () => {
    replyWith(
      Response.json({
        ...matches,
        slots: [
          {
            ...matches.slots[0]!,
            listings: [
              matchOf(item('amazon', 'Synthetic navy cotton kurta', 899), ['category', 'color', 'fabric']),
              matchOf(item('meesho', 'Synthetic kurta M', 299)),
            ],
            alternatives: [item('flipkart', 'Synthetic printed kurta', 349)],
          },
          matches.slots[1]!,
        ],
      }),
    );
    const kurtaLook = {
      ...look,
      slots: [
        { ...look.slots[0]!, lookSpec: { ...look.slots[0]!.lookSpec, fabric: 'cotton' as const } },
        ...look.slots.slice(1),
      ],
    };
    render(<ProductMatches look={kurtaLook} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });

    const best = within(screen.getByRole('list', { name: 'Matches your look: Kurta' })).getAllByRole('listitem');
    expect(best.map((li) => within(li).getByText(/^Synthetic/).textContent)).toEqual([
      'Synthetic navy cotton kurta',
      'Synthetic kurta M',
    ]);
    expect(best[0]).toHaveTextContent('Matches: navy · cotton');
    expect(best[1]).not.toHaveTextContent('Matches:');

    const other = within(screen.getByRole('list', { name: 'Other Kurta styles' })).getAllByRole('listitem');
    expect(other).toHaveLength(1);
    expect(other[0]).toHaveTextContent('Synthetic printed kurta');
    expect(other[0]).toHaveTextContent('Different style');
    // Cheapest uses the cheapest match, not the first one.
    expect(screen.getByRole('group', { name: 'Compare totals' })).toHaveTextContent(
      'Cheapest found for this look: ₹798',
    );

    // Another style can be saved too; only the listing's own fields are sent.
    shopActions.pickProductAction.mockResolvedValueOnce({ picks: [] });
    await userEvent.click(
      within(await openOptions('Synthetic printed kurta')).getByRole('button', { name: 'Save to this look' }),
    );
    expect(shopActions.pickProductAction).toHaveBeenCalledWith(
      ID,
      'top',
      item('flipkart', 'Synthetic printed kurta', 349),
    );
  });

  it('shows 8 items in each list at first, and more with "Show more"', async () => {
    const many = (n: number, what: string) =>
      Array.from({ length: n }, (_, i) => item('amazon', `Synthetic ${what} ${i}`, 300 + i));
    replyWith(
      Response.json({
        ...matches,
        slots: [
          { ...matches.slots[0]!, listings: many(20, 'kurta').map((l) => matchOf(l)), alternatives: many(10, 'style') },
          matches.slots[1]!,
        ],
      }),
    );
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });

    const shownIn = (name: string) => within(screen.getByRole('list', { name })).getAllByRole('listitem').length;
    expect(shownIn('Matches your look: Kurta')).toBe(8);
    expect(shownIn('Other Kurta styles')).toBe(8);
    expect(screen.getByRole('heading', { name: 'Matches your look (20)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show more (12 left)' }));
    expect(shownIn('Matches your look: Kurta')).toBe(16);
    await userEvent.click(screen.getByRole('button', { name: 'Show more (4 left)' }));
    expect(shownIn('Matches your look: Kurta')).toBe(20);
    // The other styles list has its own button.
    await userEvent.click(screen.getByRole('button', { name: 'Show more (2 left)' }));
    expect(shownIn('Other Kurta styles')).toBe(10);
    expect(screen.queryByRole('button', { name: /^Show more/ })).not.toBeInTheDocument();
  });

  it('#134 an item without a Google link still links to its store', async () => {
    replyWith(
      Response.json({
        ...matches,
        slots: [
          { ...matches.slots[0]!, listings: [matchOf({ ...item('amazon', 'Synthetic kurta A', 699), link: null })] },
        ],
      }),
    );
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    const options = await openOptions('Synthetic kurta A');
    expect(within(options).getByRole('link', { name: /on Amazon/ })).toHaveAttribute(
      'href',
      'https://www.amazon.in/s?k=Synthetic%20kurta%20A',
    );
    expect(within(options).queryByRole('link', { name: 'Google Shopping' })).toBeNull();
  });

  it('#124 every item has a Virtual Try-On button that tries that item on (D-138)', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    for (const slot of matches.slots) {
      for (const listing of slot.listings) {
        const tryOn = screen.getByRole('link', { name: `Virtual Try-On: ${listing.title}` });
        const href = new URL(tryOn.getAttribute('href')!, 'http://localhost');
        expect(href.pathname).toBe('/try-on');
        expect(Object.fromEntries(href.searchParams)).toEqual({
          outfitId: look.id,
          slotId: slot.slotId,
          store: listing.store,
          title: listing.title,
          price: String(listing.price),
        });
      }
    }
  });

  it('#125 clicking an item opens its Save and Virtual Try-On options; clicking again or Escape closes them', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    expect(screen.queryByRole('button', { name: /Save to this look/ })).toBeNull();

    const card = screen.getByRole('button', { name: /^Synthetic kurta A/ });
    expect(card).toHaveAttribute('aria-expanded', 'false');
    const options = await openOptions('Synthetic kurta A');
    expect(card).toHaveAttribute('aria-expanded', 'true');
    expect(within(options).getByRole('button', { name: 'Save to this look' })).toBeInTheDocument();
    expect(
      within(options).getByRole('link', { name: 'Virtual Try-On: Synthetic kurta A' }).getAttribute('href'),
    ).toMatch(/^\/try-on\?outfitId=.+&title=Synthetic\+kurta\+A&/);
    // Only one item's options are open at a time.
    await openOptions('Synthetic kurta M');
    expect(screen.queryByRole('group', { name: 'Options for Synthetic kurta A' })).toBeNull();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: /^Options for/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Synthetic kurta M/ })).toHaveFocus();
    await openOptions('Synthetic kurta M');
    await userEvent.click(screen.getByRole('button', { name: /^Synthetic kurta M/ }));
    expect(screen.queryByRole('group', { name: /^Options for/ })).toBeNull();
  });

  it('filters by store and compares the picks with the budget per look', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={1000} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });

    await userEvent.click(screen.getByRole('button', { name: 'Amazon' }));
    expect(screen.queryByText('Synthetic kurta M')).toBeNull();
    expect(screen.getByRole('region', { name: /^Trousers/ })).toHaveTextContent(
      'No items matching your look found on Amazon.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'All stores' }));

    const kurta = item('amazon', 'Synthetic kurta A', 699);
    const trousers = item('flipkart', 'Synthetic trousers F', 499);
    shopActions.pickProductAction
      .mockResolvedValueOnce({ picks: [asPick('top', kurta)] })
      .mockResolvedValueOnce({ picks: [asPick('top', kurta), asPick('bottom', trousers)] });
    shopActions.unpickProductAction.mockResolvedValueOnce({ picks: [asPick('bottom', trousers)] });
    await userEvent.click(
      within(await openOptions('Synthetic kurta A')).getByRole('button', { name: 'Save to this look' }),
    );
    await userEvent.click(
      within(await openOptions('Synthetic trousers F')).getByRole('button', { name: 'Save to this look' }),
    );
    expect(shopActions.pickProductAction).toHaveBeenLastCalledWith(ID, 'bottom', trousers);
    const totals = screen.getByRole('group', { name: 'Compare totals' });
    expect(totals).toHaveTextContent('Your saved items (2 of 2): ₹1,198 — over your ₹1,000 budget per look by ₹198.');

    await userEvent.click(
      within(await openOptions('Synthetic kurta A')).getByRole('button', { name: 'Remove from this look' }),
    );
    expect(totals).toHaveTextContent(
      'Your saved items (1 of 2): ₹499 — within your ₹1,000 budget per look, ₹501 left.',
    );
    expect(screen.getByRole('button', { name: /Synthetic kurta A/ })).not.toHaveTextContent(/^Saved/);
    expect(screen.getByRole('button', { name: /Synthetic trousers F/ })).toHaveTextContent(/^Saved/);
  });

  it('starts from the picks saved on the look, and puts them back with the reason when saving fails', async () => {
    replyWith(Response.json(matches));
    const saved = asPick('top', item('meesho', 'Synthetic kurta M', 299));
    render(
      <ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} initialPicks={[saved]} />,
    );
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    // #126: the saved item is marked on its card without opening it.
    expect(screen.getByRole('button', { name: /Synthetic kurta M/ })).toHaveTextContent(/^Saved/);
    expect(screen.getByRole('button', { name: /Synthetic kurta A/ })).not.toHaveTextContent(/^Saved/);
    expect(
      within(await openOptions('Synthetic kurta M')).getByRole('button', { name: 'Remove from this look' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Compare totals' })).toHaveTextContent('Your saved items (1 of 2): ₹299');

    shopActions.pickProductAction.mockResolvedValueOnce({
      error: 'That item is no longer in the search results. Please pick another.',
    });
    await userEvent.click(
      within(await openOptions('Synthetic kurta A')).getByRole('button', { name: 'Save to this look' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer in the search results');
    // The earlier saved item is still the saved one.
    expect(
      within(await openOptions('Synthetic kurta M')).getByRole('button', { name: 'Remove from this look' }),
    ).toBeInTheDocument();
  });

  it('never shows made-up items: an error or a malformed reply shows the fallback', async () => {
    for (const res of [
      Response.json({ error: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 }),
      Response.json({ ...matches, label: 'Exact matches' }),
    ]) {
      replyWith(res);
      const view = render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
      expect(await screen.findByText('Product data unavailable')).toBeInTheDocument();
      expect(screen.queryByText(/Synthetic/)).toBeNull();
      view.unmount();
    }
  });
});

describe('the look on a body-type figure (D-119)', () => {
  it('draws a figure of the profile’s body type in the look’s colours, garments only, with the label', () => {
    render(<BodyTypeFigure look={look} department="women" bodyType="pear" />);
    const figure = screen.getByRole('img', {
      name: 'Illustrative woman with a pear body type wearing navy top and cream bottom',
    });
    expect(figure.querySelector('[data-garment="top"]')).toHaveAttribute('fill', '#1F2A44');
    expect(figure.querySelector('[data-garment="bottom"]')).toHaveAttribute('fill', '#F3E9D2');
    expect(screen.getByText(FIGURE_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(/Add your body type/)).toBeNull();
  });

  it('changes shape with the body type', () => {
    const { rerender, container } = render(
      <BodyTypeFigure look={look} department="men" bodyType="inverted_triangle" />,
    );
    const wide = container.querySelector('[data-garment="top"]')!.getAttribute('d');
    rerender(<BodyTypeFigure look={look} department="men" bodyType="triangle" />);
    expect(container.querySelector('[data-garment="top"]')!.getAttribute('d')).not.toBe(wide);
  });

  it('without a body type, or one not drawn for that figure, shows the default figure and asks for it', () => {
    const { rerender } = render(<BodyTypeFigure look={look} department="men" bodyType={null} />);
    expect(screen.getByRole('img', { name: 'Illustrative man wearing navy top and cream bottom' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Profile' })).toHaveAttribute('href', '/profile');
    rerender(<BodyTypeFigure look={look} department="men" bodyType="hourglass" />);
    expect(screen.getByRole('img', { name: 'Illustrative man wearing navy top and cream bottom' })).toBeInTheDocument();
  });
});
