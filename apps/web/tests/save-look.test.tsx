// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, ProfileSizes } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  saveOutfitAction: vi.fn(),
  removeOutfitAction: vi.fn(),
  feedbackOutfitAction: vi.fn(),
  getFreshAlternativesAction: vi.fn(),
}));
vi.mock('@/app/actions/outfits', () => actions);

import { LookCard } from '@/components/outfits/LookCard';
import { SaveLookButton } from '@/components/outfits/SaveLookButton';

// Save on a generated look (FR-OUT-01, #47).

const ID = 'a'.repeat(24);
const SIZES: ProfileSizes = { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null };
const look = (status: Look['status']): Look => ({
  id: ID,
  status,
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  explanation: 'A navy kurta for work.',
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: 'sig-1',
  aiModel: null,
  slots: [
    {
      slotId: 'top',
      slot: 'top',
      lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy' },
      swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
      searchPhrase: 'navy kurta',
      sizeNote: 'Add your size',
      alternatives: [],
    },
  ],
});

beforeEach(() => actions.saveOutfitAction.mockReset());

describe('Save to Saved Outfits', () => {
  it('saves the look by its ID, then confirms and links to it', async () => {
    actions.saveOutfitAction.mockResolvedValue({ success: 'Saved to Saved Outfits.' });
    const user = userEvent.setup();
    render(<SaveLookButton outfitId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Save to Saved Outfits' }));

    expect((actions.saveOutfitAction.mock.calls[0]![1] as FormData).get('outfitId')).toBe(ID);
    expect(await screen.findByRole('status')).toHaveTextContent('Saved to Saved Outfits.');
    expect(screen.getByRole('link', { name: 'View in Saved Outfits' })).toHaveAttribute('href', `/saved/${ID}`);
    expect(screen.queryByRole('button', { name: 'Save to Saved Outfits' })).not.toBeInTheDocument();
  });

  it('disables the button while saving', async () => {
    let finish: (state: { success: string }) => void = () => {};
    actions.saveOutfitAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<SaveLookButton outfitId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Save to Saved Outfits' }));
    expect(await screen.findByRole('button', { name: 'Saving…' })).toBeDisabled();
    finish({ success: 'Saved to Saved Outfits.' });
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });

  it('shows the error and keeps the button when saving fails', async () => {
    actions.saveOutfitAction.mockResolvedValue({ error: 'This look is no longer available.' });
    const user = userEvent.setup();
    render(<SaveLookButton outfitId={ID} />);
    await user.click(screen.getByRole('button', { name: 'Save to Saved Outfits' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This look is no longer available.');
    expect(screen.getByRole('button', { name: 'Save to Saved Outfits' })).toBeEnabled();
  });

  it('is on every look card, and an already saved look links straight to it', () => {
    const { rerender } = render(<LookCard look={look('suggested')} position={1} sizes={SIZES} />);
    expect(screen.getByRole('button', { name: 'Save to Saved Outfits' })).toBeInTheDocument();
    rerender(<LookCard look={look('saved')} position={1} sizes={SIZES} />);
    expect(screen.queryByRole('button', { name: 'Save to Saved Outfits' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View in Saved Outfits' })).toHaveAttribute('href', `/saved/${ID}`);
  });
});
