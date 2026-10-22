// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, LookSlot, ProfileSizes } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  feedbackOutfitAction: vi.fn(),
}));
vi.mock('@/app/actions/outfits', () => actions);

import { FeedbackButtons } from '@/components/outfits/FeedbackButtons';
import { LookDetail } from '@/components/outfits/LookDetail';

const SIZES: ProfileSizes = { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null };

const SLOT_TOP: LookSlot = {
  slotId: 'top',
  slot: 'top',
  lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy', fabric: 'cotton' },
  swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
  searchPhrase: 'navy cotton kurta',
  sizeNote: 'Select a size',
  alternatives: [
    {
      lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'sky_blue' },
      swatches: [{ colorId: 'sky_blue', name: 'Sky blue', hex: '#87CEEB' }],
      searchPhrase: 'sky blue kurta',
    },
  ],
};

const SLOT_BOTTOM: LookSlot = {
  slotId: 'bottom',
  slot: 'bottom',
  lookSpec: { category: 'trousers', colorFamily: 'neutral', colorId: 'ivory' },
  swatches: [{ colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' }],
  searchPhrase: 'ivory trousers',
  sizeNote: 'Select a size',
  alternatives: [],
};

const SAMPLE_SLOTS: LookSlot[] = [SLOT_TOP, SLOT_BOTTOM];

const LOOK: Look = {
  id: '64b7f0c2a1b2c3d4e5f60718',
  status: 'saved',
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: SAMPLE_SLOTS,
  explanation: 'Clean styling.',
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: 'sig123',
  aiModel: null,
};

beforeEach(() => {
  actions.feedbackOutfitAction.mockReset();
});

describe('FeedbackButtons', () => {
  it('renders "Love it" and "Not for me" buttons', () => {
    render(<FeedbackButtons outfitId={LOOK.id} />);
    expect(screen.getByRole('button', { name: 'Love this look' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not for me' })).toBeInTheDocument();
  });

  it('reflects initial feedback state if provided', () => {
    render(<FeedbackButtons outfitId={LOOK.id} initialFeedback={{ value: 'love_it' }} />);
    const loveBtn = screen.getByRole('button', { name: 'Love this look' });
    expect(loveBtn).toHaveAttribute('aria-pressed', 'true');
    expect(loveBtn).toHaveTextContent('Loved');
  });

  it('submits love_it feedback when "Love it" is clicked', async () => {
    actions.feedbackOutfitAction.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<FeedbackButtons outfitId={LOOK.id} />);

    await user.click(screen.getByRole('button', { name: 'Love this look' }));
    await waitFor(() => expect(actions.feedbackOutfitAction).toHaveBeenCalledTimes(1));

    const formData = (actions.feedbackOutfitAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.get('outfitId')).toBe(LOOK.id);
    expect(formData.get('value')).toBe('love_it');
  });

  it('reveals reason chips on "Not for me" and submits selected reason', async () => {
    actions.feedbackOutfitAction.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<FeedbackButtons outfitId={LOOK.id} />);

    // Click "Not for me"
    await user.click(screen.getByRole('button', { name: 'Not for me' }));
    await waitFor(() => expect(actions.feedbackOutfitAction).toHaveBeenCalledTimes(1));

    // Reasons container should now be visible
    // Click a reason chip
    const reasonButton = await screen.findByRole('button', { name: 'Colours not for me' });
    await user.click(reasonButton);
    await waitFor(() => expect(actions.feedbackOutfitAction).toHaveBeenCalledTimes(2));

    const secondFormData = (actions.feedbackOutfitAction.mock.calls[1] as unknown as [unknown, FormData])[1];
    expect(secondFormData.get('outfitId')).toBe(LOOK.id);
    expect(secondFormData.get('value')).toBe('not_for_me');
    expect(secondFormData.get('reason')).toBe('colours_not_for_me');
  });

  it('displays feedback error message if action returns error', async () => {
    actions.feedbackOutfitAction.mockResolvedValue({ error: 'Could not record feedback.' });
    const user = userEvent.setup();
    render(<FeedbackButtons outfitId={LOOK.id} />);

    await user.click(screen.getByRole('button', { name: 'Love this look' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not record feedback.');
  });
});

describe('LookDetail', () => {
  it('shows the pieces and why the look works, with no alternatives', () => {
    render(<LookDetail look={LOOK} sizes={SIZES} />);
    expect(screen.getByRole('heading', { name: 'The pieces' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Why this works' })).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText(/alternative/i)).not.toBeInTheDocument();
    expect(screen.queryByText('sky blue kurta')).not.toBeInTheDocument();
  });
});
