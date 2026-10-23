// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatConversation, ChatOverviewResponse, Look } from '@styleme/contracts';

const mocks = vi.hoisted(() => ({
  sendAssistantMessageAction: vi.fn(),
  createAssistantDesignAction: vi.fn(),
  deleteConversationAction: vi.fn(async () => ({})),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/app/actions/assistant', () => ({
  sendAssistantMessageAction: mocks.sendAssistantMessageAction,
  createAssistantDesignAction: mocks.createAssistantDesignAction,
  deleteConversationAction: mocks.deleteConversationAction,
}));
vi.mock('@/app/actions/outfits', () => ({ saveOutfitAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));

import { AssistantChat } from '@/components/chat/AssistantChat';

// Style Assistant chat (D-136): suggestions, replies with feature cards, and the design notice.

const OVERVIEW: ChatOverviewResponse = {
  aiAvailable: true,
  designAvailable: true,
  suggestions: ['What should I wear to a wedding?', 'Which colours suit me best?'],
  conversations: [],
};

const LOOK = {
  id: '64b7f0c2a1b2c3d4e5f60719',
  status: 'suggested',
  templateId: 'TPL-001',
  paletteId: 'PAL-001',
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
  explanation: 'Synthetic fixture explanation.',
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: 'sig',
  aiModel: null,
  image: 'ready',
} as unknown as Look;

const conversation = (extra: Partial<ChatConversation['messages'][number]>[]): ChatConversation => ({
  id: '64b7f0c2a1b2c3d4e5f60718',
  title: 'What should I wear to a wedding?',
  updatedAt: '2026-10-23T10:00:00.000Z',
  messages: [
    {
      id: 'm1',
      role: 'user',
      text: 'What should I wear to a wedding?',
      intent: null,
      cards: [],
      links: [],
      wording: null,
      createdAt: '2026-10-23T10:00:00.000Z',
    },
    ...extra.map((m, i) => ({
      id: `a${i}`,
      role: 'assistant' as const,
      text: 'Here are looks for a wedding.',
      intent: 'looks' as const,
      cards: [],
      links: [],
      wording: 'ai' as const,
      createdAt: '2026-10-23T10:00:01.000Z',
      ...m,
    })),
  ],
});

beforeEach(() => {
  mocks.sendAssistantMessageAction.mockReset();
  mocks.createAssistantDesignAction.mockReset();
  mocks.replace.mockClear();
});

describe('AssistantChat', () => {
  it('a suggestion sends the question and shows the reply with its looks and links', async () => {
    const user = userEvent.setup();
    mocks.sendAssistantMessageAction.mockResolvedValue({
      conversation: conversation([
        {
          cards: [{ kind: 'looks', looks: [LOOK] }],
          links: [{ label: 'More options in Discover My Style', href: '/discover/looks' }],
        },
      ]),
    });
    render(<AssistantChat overview={OVERVIEW} />);
    expect(screen.getByText(/Your photos, measurements, height, skin tone and body type never do/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'What should I wear to a wedding?' }));
    expect(mocks.sendAssistantMessageAction).toHaveBeenCalledWith('What should I wear to a wedding?', undefined);
    expect(await screen.findByText('Here are looks for a wedding.')).toBeInTheDocument();
    expect(screen.getByText('Written with AI')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Navy kurta' })).toHaveAttribute('href', `/saved/${LOOK.id}`);
    expect(screen.getByAltText('AI-generated picture of this outfit')).toHaveAttribute(
      'src',
      `/api/outfits/${LOOK.id}/image`,
    );
    expect(screen.getByRole('link', { name: 'Shop this look' })).toHaveAttribute('href', `/shop?outfitId=${LOOK.id}`);
    expect(screen.getByRole('link', { name: 'Change in Design Studio' })).toHaveAttribute(
      'href',
      `/design-studio?look=${LOOK.id}`,
    );
    expect(screen.getByRole('link', { name: /More options in Discover My Style/ })).toHaveAttribute(
      'href',
      '/discover/looks',
    );
    expect(mocks.replace).toHaveBeenCalledWith('/assistant?c=64b7f0c2a1b2c3d4e5f60718', { scroll: false });
  });

  it('keeps the question and shows the error when sending fails', async () => {
    const user = userEvent.setup();
    mocks.sendAssistantMessageAction.mockResolvedValue({ error: 'Please wait a minute.' });
    render(<AssistantChat overview={OVERVIEW} />);
    await user.type(screen.getByLabelText('Your question'), 'Diwali looks{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Please wait a minute.');
    expect(screen.getByLabelText('Your question')).toHaveValue('Diwali looks');
  });

  it('a design offer needs the notice before it creates the design', async () => {
    const user = userEvent.setup();
    const offered = conversation([
      { intent: 'design', cards: [{ kind: 'design_offer', description: 'A teal kurta with puff sleeves' }] },
    ]);
    mocks.createAssistantDesignAction.mockResolvedValue({ conversation: offered });
    render(<AssistantChat overview={OVERVIEW} initial={offered} />);

    const create = screen.getByRole('button', { name: 'Create this design' });
    expect(create).toBeDisabled();
    expect(screen.getByLabelText('Your design')).toHaveValue('A teal kurta with puff sleeves');
    await user.click(screen.getByRole('checkbox'));
    await user.click(create);
    await waitFor(() =>
      expect(mocks.createAssistantDesignAction).toHaveBeenCalledWith(
        offered.id,
        'A teal kurta with puff sleeves',
        true,
      ),
    );
  });

  it('without Gemini it says replies come from StyleMe', () => {
    render(<AssistantChat overview={{ ...OVERVIEW, aiAvailable: false }} />);
    expect(screen.getByText(/Replies are written by StyleMe/)).toBeInTheDocument();
  });
});
