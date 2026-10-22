// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, LookSlot, ProfileSizes } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  feedbackOutfitAction: vi.fn(),
  getFreshAlternativesAction: vi.fn(),
}));
vi.mock('@/app/actions/outfits', () => actions);

import { FeedbackButtons } from '@/components/outfits/FeedbackButtons';
import { SavedAlternatives } from '@/components/outfits/SavedAlternatives';
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
  actions.getFreshAlternativesAction.mockReset();
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

describe('SavedAlternatives', () => {
  it('renders stored alternatives for slots', () => {
    render(<SavedAlternatives outfitId={LOOK.id} slots={SAMPLE_SLOTS} />);
    expect(screen.getByRole('heading', { name: 'Alternatives for this look' })).toBeInTheDocument();
    expect(screen.getByText('Stored variations for each slot saved with this look.')).toBeInTheDocument();
    expect(screen.getByText('Sky blue')).toBeInTheDocument();
    expect(screen.getByText('sky blue kurta')).toBeInTheDocument();
  });

  it('refreshes alternatives from engine when "Get fresh alternatives" is clicked', async () => {
    const freshSlots: LookSlot[] = [
      {
        ...SLOT_TOP,
        alternatives: [
          {
            lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'indigo' },
            swatches: [{ colorId: 'indigo', name: 'Indigo', hex: '#4B0082' }],
            searchPhrase: 'indigo kurta',
          },
        ],
      },
      SLOT_BOTTOM,
    ];

    actions.getFreshAlternativesAction.mockResolvedValue({
      slots: freshSlots,
    });

    const user = userEvent.setup();
    render(<SavedAlternatives outfitId={LOOK.id} slots={SAMPLE_SLOTS} />);

    const refreshButton = screen.getByRole('button', { name: 'Get fresh alternatives' });
    await user.click(refreshButton);

    await waitFor(() => expect(actions.getFreshAlternativesAction).toHaveBeenCalledTimes(1));
    const formData = (actions.getFreshAlternativesAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.get('outfitId')).toBe(LOOK.id);

    // Fresh badge and updated alternative should now show
    expect(await screen.findByText('Fresh from engine')).toBeInTheDocument();
    expect(screen.getByText('Indigo')).toBeInTheDocument();
    expect(screen.getByText('indigo kurta')).toBeInTheDocument();
  });

  it('displays error if getting fresh alternatives fails', async () => {
    actions.getFreshAlternativesAction.mockResolvedValue({
      error: 'Engine could not generate alternatives.',
    });

    const user = userEvent.setup();
    render(<SavedAlternatives outfitId={LOOK.id} slots={SAMPLE_SLOTS} />);

    await user.click(screen.getByRole('button', { name: 'Get fresh alternatives' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Engine could not generate alternatives.');
  });
});

describe('LookDetail tab switching', () => {
  it('switches between "The pieces" and "Alternatives" tabs', async () => {
    const user = userEvent.setup();
    render(<LookDetail look={LOOK} sizes={SIZES} />);

    // Initially "The pieces" tab is selected
    const piecesTab = screen.getByRole('tab', { name: 'The pieces' });
    const alternativesTab = screen.getByRole('tab', { name: 'Alternatives' });
    expect(piecesTab).toHaveAttribute('aria-selected', 'true');
    expect(alternativesTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', { name: 'Why this works' })).toBeInTheDocument();

    // Click "Alternatives" tab
    await user.click(alternativesTab);
    expect(alternativesTab).toHaveAttribute('aria-selected', 'true');
    expect(piecesTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('heading', { name: 'Alternatives for this look' })).toBeInTheDocument();

    // Click "The pieces" tab to return
    await user.click(piecesTab);
    expect(piecesTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Why this works' })).toBeInTheDocument();
  });
});
