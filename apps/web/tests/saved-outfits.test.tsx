// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, ProfileSizes } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  saveOutfitAction: vi.fn(),
  removeOutfitAction: vi.fn(),
  feedbackOutfitAction: vi.fn(),
}));
vi.mock('@/app/actions/outfits', () => actions);

import { SavedLookCard } from '@/components/outfits/SavedLookCard';
import { LookDetail } from '@/components/outfits/LookDetail';
import { RemoveLookButton } from '@/components/outfits/RemoveLookButton';
import { SavedLookList } from '@/components/outfits/SavedLookList';
import { lookTitle } from '@/lib/outfits/look-text';

// Saved Outfits (FR-OUT-01 … 03, #41): list, details and remove with confirmation.

// The look stored 'Your saved size: M'; the profile now says L, and the page must show the current size.
const SIZES: ProfileSizes = { tops: null, bottoms: null, ethnicTops: { letter: 'L' }, ethnicSets: null, shoes: null };

const LOOK: Look = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  status: 'saved',
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: [
    {
      slotId: 'top',
      slot: 'top',
      lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy', fabric: 'cotton', sleeve: 'three_quarter' },
      swatches: [
        { colorId: 'navy', name: 'Navy', hex: '#1F2A44' },
        { colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' },
      ],
      searchPhrase: 'navy cotton kurta',
      sizeNote: 'Your saved size: M',
      alternatives: [],
    },
    {
      slotId: 'bottom',
      slot: 'bottom',
      lookSpec: { category: 'trousers', colorFamily: 'neutral', colorId: 'ivory' },
      swatches: [{ colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' }],
      searchPhrase: 'ivory trousers',
      sizeNote: 'Add your bottoms size to your profile for a size note.',
      alternatives: [],
    },
  ],
  explanation: 'Navy and ivory give a calm, clear contrast for everyday wear.',
  explanationRefs: { ruleIds: ['STY-001'], attributes: [] },
  combinationSignature: 'abc123',
  aiModel: null,
};

/** Every swatch chip has its colour name as text, not only a coloured dot. */
function expectEverySwatchNamed(container: HTMLElement) {
  const chips = Array.from(container.querySelectorAll('li > span[aria-hidden][style]'), (dot) => dot.parentElement!);
  expect(chips.length).toBe(LOOK.slots.flatMap((s) => s.swatches).length);
  for (const chip of chips) expect(chip.textContent?.trim()).toMatch(/^(Navy|Ivory)$/);
}

beforeEach(() => {
  actions.saveOutfitAction.mockReset();
  actions.removeOutfitAction.mockReset();
  actions.feedbackOutfitAction.mockReset();
});

describe('saved look card', () => {
  it('names each piece and colour in text and links to the details', () => {
    const { container } = render(<SavedLookCard look={LOOK} />);
    expect(screen.getByRole('link', { name: 'Navy kurta · Ivory trousers' })).toHaveAttribute(
      'href',
      `/saved/${LOOK.id}`,
    );
    expectEverySwatchNamed(container);
    expect(screen.getByText('Top')).toBeInTheDocument();
    expect(screen.getByText('Bottom')).toBeInTheDocument();
    expect(screen.getByText(LOOK.explanation)).toBeInTheDocument();
  });
});

describe('saved look details', () => {
  it('shows labelled swatches, the specification in words, search phrase, size note and why it works', () => {
    const { container } = render(<LookDetail look={LOOK} sizes={SIZES} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Navy kurta · Ivory trousers');
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expectEverySwatchNamed(container);

    const top = screen.getByRole('heading', { name: 'Kurta' }).closest('li')!;
    const terms = Array.from(top.querySelectorAll('dt')).map((dt) => [dt.textContent, dt.nextSibling?.textContent]);
    expect(terms).toEqual([
      ['Piece', 'Kurta'],
      ['Colour', 'Navy'],
      ['Colour family', 'Blue'],
      ['Fabric', 'Cotton'],
      ['Sleeves', 'Three-quarter'],
    ]);
    expect(within(top).getByText('navy cotton kurta')).toBeInTheDocument();
    // From the current profile sizes (FR-SIZE-04), not the text stored with the look.
    expect(top).toHaveTextContent('Your saved size: L');
    expect(top).not.toHaveTextContent('Your saved size: M');
    const bottom = screen.getByRole('heading', { name: 'Trousers' }).closest('li')!;
    expect(within(bottom).getByRole('link', { name: 'Add your size' })).toHaveAttribute('href', '/profile#sizes');
    expect(screen.getByRole('heading', { name: 'Why this works' })).toBeInTheDocument();
    expect(screen.getByText(LOOK.explanation)).toBeInTheDocument();
  });

  it('says when a look is not saved yet', () => {
    render(<LookDetail look={{ ...LOOK, status: 'suggested' }} sizes={SIZES} />);
    expect(screen.getByRole('status')).toHaveTextContent('isn’t saved yet');
  });
});

describe('saved looks list', () => {
  it('shows the empty state with a way to find looks', () => {
    render(<SavedLookList looks={[]} page={1} limit={12} total={0} />);
    expect(screen.getByRole('heading', { name: 'No saved looks yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find looks for an occasion' })).toHaveAttribute('href', '/discover/looks');
  });

  it('shows the count, one card per look and page links', () => {
    const second = { ...LOOK, id: '64b7f0c2a1b2c3d4e5f60719' };
    render(<SavedLookList looks={[LOOK, second]} page={2} limit={2} total={5} />);
    expect(screen.getByText('5 saved looks')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Navy kurta · Ivory trousers' })).toHaveLength(2);
    const pages = screen.getByRole('navigation', { name: 'Saved looks pages' });
    expect(within(pages).getByText('Page 2 of 3')).toBeInTheDocument();
    expect(within(pages).getByRole('link', { name: 'Previous' })).toHaveAttribute('href', '/saved?page=1');
    expect(within(pages).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/saved?page=3');
  });

  it('has no page links when everything fits on one page', () => {
    render(<SavedLookList looks={[LOOK]} page={1} limit={12} total={1} />);
    expect(screen.getByText('1 saved look')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

describe('removing a look', () => {
  it('asks for confirmation before calling the action, and Cancel sends nothing', async () => {
    actions.removeOutfitAction.mockResolvedValue({ success: 'Look removed.' });
    const user = userEvent.setup();
    render(<RemoveLookButton outfitId={LOOK.id} lookName={lookTitle(LOOK)} from="detail" />);

    await user.click(screen.getByRole('button', { name: 'Remove Navy kurta · Ivory trousers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove this look?' });
    expect(dialog).toHaveTextContent('Navy kurta · Ivory trousers will be removed from Saved Outfits.');
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(actions.removeOutfitAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^Remove Navy/ }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove look' }));
    await waitFor(() => expect(actions.removeOutfitAction).toHaveBeenCalledTimes(1));
    const formData = (actions.removeOutfitAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.get('outfitId')).toBe(LOOK.id);
    expect(formData.get('from')).toBe('detail');
  });

  it('shows the action’s error', async () => {
    actions.removeOutfitAction.mockResolvedValue({ error: 'This look is no longer available.' });
    const user = userEvent.setup();
    render(<RemoveLookButton outfitId={LOOK.id} lookName="Look" from="list" />);
    await user.click(screen.getByRole('button', { name: 'Remove Look' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove look' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This look is no longer available.');
  });
});
