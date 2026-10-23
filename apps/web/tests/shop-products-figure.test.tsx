// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_MATCHES_LABEL,
  type Look,
  type LookProductMatches,
  type LookSlot,
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

const matches: LookProductMatches = {
  currency: 'INR',
  priceBasis: 'search_results',
  slots: [
    {
      slotId: 'top',
      listings: [item('meesho', 'Synthetic kurta M', 299), item('amazon', 'Synthetic kurta A', 699)],
      stats: [
        { store: 'amazon', listings: 1, min: 699, median: 699, max: 699 },
        { store: 'meesho', listings: 1, min: 299, median: 299, max: 299 },
      ],
    },
    {
      slotId: 'bottom',
      listings: [item('flipkart', 'Synthetic trousers F', 499)],
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
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
  return screen.getByRole('group', { name: `Options for ${title}` });
}

describe('similar products to compare', () => {
  it('lists each garment’s items with the store’s title, price, thumbnail and Google Shopping link, with the label', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    expect(await screen.findByRole('heading', { name: 'Similar items to compare' })).toBeInTheDocument();
    expect(screen.getByText(PRODUCT_MATCHES_LABEL)).toBeInTheDocument();

    const kurta = screen.getByRole('region', { name: /^Kurta/ });
    expect(within(kurta).getByText('Synthetic kurta M').closest('li')).toHaveTextContent('₹299 · Meesho');
    expect(within(kurta).getByRole('list', { name: 'Prices by store for Kurta' })).toHaveTextContent(
      'Amazon: 1 found, ₹699 – ₹699 (typical ₹699)',
    );
    const options = await openOptions('Synthetic kurta M');
    const link = within(options).getByRole('link', { name: 'View on Google Shopping' });
    expect(link).toHaveAttribute('href', 'https://www.google.com/search?ibp=oshop&q=synthetic');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(kurta.querySelector('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(screen.getByRole('group', { name: 'Compare totals' })).toHaveTextContent(
      'Cheapest found for this look: ₹798',
    );
  });

  it('#124 every item has a Virtual Try-On button that opens the Coming soon page until try-on exists', async () => {
    replyWith(Response.json(matches));
    render(<ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} />);
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    for (const title of ['Synthetic kurta M', 'Synthetic kurta A', 'Synthetic trousers F']) {
      const tryOn = screen.getByRole('link', { name: `Virtual Try-On: ${title} (coming soon)` });
      expect(tryOn).toHaveAttribute('href', '/features/virtual-try-on');
      expect(tryOn).toHaveTextContent('Soon');
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
      within(options).getByRole('link', { name: 'Virtual Try-On: Synthetic kurta A (coming soon)' }),
    ).toHaveAttribute('href', '/features/virtual-try-on');
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
    expect(screen.getByRole('region', { name: /^Trousers/ })).toHaveTextContent('No similar items found on Amazon.');
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
    expect(totals).toHaveTextContent('Your picks (2 of 2): ₹1,198 — over your ₹1,000 budget per look by ₹198.');

    await userEvent.click(
      within(await openOptions('Synthetic kurta A')).getByRole('button', { name: 'Saved to this look' }),
    );
    expect(totals).toHaveTextContent('Your picks (1 of 2): ₹499 — within your ₹1,000 budget per look, ₹501 left.');
  });

  it('starts from the picks saved on the look, and puts them back with the reason when saving fails', async () => {
    replyWith(Response.json(matches));
    const saved = asPick('top', item('meesho', 'Synthetic kurta M', 299));
    render(
      <ProductMatches look={look} budget={null} fallback={<p>Product data unavailable</p>} initialPicks={[saved]} />,
    );
    await screen.findByRole('heading', { name: 'Similar items to compare' });
    expect(
      within(await openOptions('Synthetic kurta M')).getByRole('button', { name: 'Saved to this look' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Compare totals' })).toHaveTextContent('Your picks (1 of 2): ₹299');

    shopActions.pickProductAction.mockResolvedValueOnce({
      error: 'That item is no longer in the search results. Please pick another.',
    });
    await userEvent.click(
      within(await openOptions('Synthetic kurta A')).getByRole('button', { name: 'Save to this look' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer in the search results');
    // The earlier saved item is still the saved one.
    expect(
      within(await openOptions('Synthetic kurta M')).getByRole('button', { name: 'Saved to this look' }),
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
