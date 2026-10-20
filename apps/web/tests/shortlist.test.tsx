// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_ENTERED_LABELS, type UserShortlistItem } from '@styleme/contracts';

// Server actions are mocked: these tests cover the browser-side behaviour only.
const actions = vi.hoisted(() => ({ addShortlistItemAction: vi.fn(), removeShortlistItemAction: vi.fn() }));
vi.mock('@/app/actions/shortlist', () => actions);

import { ShortlistForm } from '@/components/shop/ShortlistForm';
import { ShortlistItemCard } from '@/components/shop/ShortlistItemCard';

const LINK = 'https://Shop.example/kurtas/Indigo-Kurta?utm_source=friend&ref=abc#details';

const ITEM: UserShortlistItem = {
  id: '6650f0c2a1b2c3d4e5f60718',
  name: 'Indigo cotton kurta',
  priceEntered: 1299.5,
  currency: 'INR',
  priceBasis: 'user_entered',
  verifiedByStyleMe: false,
  url: LINK,
  note: 'Ask about the dupatta',
  outfitId: null,
  slotId: null,
  createdAt: '2026-10-20T06:30:00.000Z',
};

beforeEach(() => {
  actions.addShortlistItemAction.mockReset();
  actions.removeShortlistItemAction.mockReset();
});

describe('add an item you found (FR-LIST-01)', () => {
  it('sends the typed values to the action and clears the form once the item is added', async () => {
    actions.addShortlistItemAction.mockResolvedValue({ success: '“Indigo cotton kurta” was added to your shortlist.' });
    const user = userEvent.setup();
    render(<ShortlistForm />);
    await user.type(screen.getByLabelText('Item name'), 'Indigo cotton kurta');
    await user.type(screen.getByLabelText('Price you saw (₹)'), '1,299.50');
    await user.type(screen.getByLabelText(/^Link/), LINK);
    await user.type(screen.getByLabelText(/^Note/), 'Ask about the dupatta');
    await user.click(screen.getByRole('button', { name: 'Add to shortlist' }));

    const formData = actions.addShortlistItemAction.mock.calls[0]![1] as FormData;
    expect(formData.get('name')).toBe('Indigo cotton kurta');
    expect(formData.get('priceEntered')).toBe('1,299.50');
    expect(formData.get('url')).toBe(LINK);
    expect(formData.get('note')).toBe('Ask about the dupatta');
    expect(await screen.findByRole('status')).toHaveTextContent('was added to your shortlist');
    expect(screen.getByLabelText('Item name')).toHaveValue('');
    expect(screen.getByLabelText(/^Link/)).toHaveValue('');
  });

  it('shows field errors from the action and keeps what was typed', async () => {
    actions.addShortlistItemAction.mockResolvedValue({
      error: 'Please check the highlighted fields.',
      fieldErrors: { priceEntered: 'Enter the price you saw.', url: 'Enter a link that starts with https://' },
    });
    const user = userEvent.setup();
    render(<ShortlistForm />);
    await user.type(screen.getByLabelText('Item name'), 'Juttis');
    await user.type(screen.getByLabelText(/^Link/), 'http://shop.example/juttis');
    await user.click(screen.getByRole('button', { name: 'Add to shortlist' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Please check the highlighted fields.');
    const price = screen.getByLabelText('Price you saw (₹)');
    expect(price).toHaveAttribute('aria-invalid', 'true');
    expect(price).toHaveAccessibleDescription('Enter the price you saw.');
    expect(screen.getByLabelText(/^Link/)).toHaveAccessibleDescription('Enter a link that starts with https://');
    expect(screen.getByLabelText('Item name')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('Item name')).toHaveValue('Juttis');
    expect(screen.getByLabelText(/^Link/)).toHaveValue('http://shop.example/juttis');
  });

  it('says the price is the user’s own entry before anything is added', () => {
    render(<ShortlistForm />);
    expect(screen.getByLabelText('Price you saw (₹)')).toHaveAccessibleDescription(USER_ENTERED_LABELS.price);
  });
});

describe('a shortlist item (FR-LIST-02, -03, -05)', () => {
  it('always shows the item and price labels, without extra clicks', () => {
    const { rerender } = render(<ShortlistItemCard item={ITEM} />);
    expect(screen.getByText(USER_ENTERED_LABELS.item)).toBeVisible();
    expect(screen.getByText(USER_ENTERED_LABELS.price)).toBeVisible();
    expect(screen.getByText('₹1,299.50')).toBeInTheDocument();
    expect(screen.getByText('Ask about the dupatta')).toBeInTheDocument();

    rerender(<ShortlistItemCard item={{ ...ITEM, url: null, note: null, priceEntered: 450 }} />);
    expect(screen.getByText(USER_ENTERED_LABELS.item)).toBeVisible();
    expect(screen.getByText(USER_ENTERED_LABELS.price)).toBeVisible();
    expect(screen.getByText('₹450')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders the link exactly as entered, opening in a new tab with rel="noopener noreferrer nofollow"', () => {
    render(<ShortlistItemCard item={ITEM} />);
    const link = screen.getByRole('link', { name: /Shop\.example/ });
    expect(link).toHaveAttribute('href', LINK);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');
    expect(link).toHaveTextContent(LINK);
  });

  it('shows no shop name, logo or image derived from the link (B-06)', () => {
    const { container } = render(<ShortlistItemCard item={ITEM} />);
    expect(container.querySelector('img, picture, iframe')).toBeNull();
    expect(screen.queryByText(/in stock|rating|review|delivery/i)).toBeNull();
  });

  it('asks for confirmation before removing, and Cancel sends nothing', async () => {
    actions.removeShortlistItemAction.mockResolvedValue({ success: 'The item was removed from your shortlist.' });
    const user = userEvent.setup();
    render(<ShortlistItemCard item={ITEM} />);
    const remove = screen.getByRole('button', { name: 'Remove Indigo cotton kurta' });

    await user.click(remove);
    const confirm = await screen.findByRole('dialog', { name: 'Remove this item?' });
    expect(confirm).toHaveTextContent('Indigo cotton kurta');
    expect(actions.removeShortlistItemAction).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(actions.removeShortlistItemAction).not.toHaveBeenCalled();

    await user.click(remove);
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(actions.removeShortlistItemAction).toHaveBeenCalledTimes(1));
    const formData = actions.removeShortlistItemAction.mock.calls[0]![1] as FormData;
    expect(formData.get('id')).toBe(ITEM.id);
  });

  it('shows why a removal failed', async () => {
    actions.removeShortlistItemAction.mockResolvedValue({ error: 'This item was already removed.' });
    const user = userEvent.setup();
    render(<ShortlistItemCard item={ITEM} />);
    await user.click(screen.getByRole('button', { name: 'Remove Indigo cotton kurta' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Yes, remove' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This item was already removed.');
  });
});
