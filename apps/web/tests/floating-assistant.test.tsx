// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatConversation } from '@styleme/contracts';

const mocks = vi.hoisted(() => ({
  sendAssistantMessageAction: vi.fn(),
  createAssistantDesignAction: vi.fn(),
  pathname: '/home',
}));

vi.mock('@/app/actions/assistant', () => ({
  sendAssistantMessageAction: mocks.sendAssistantMessageAction,
  createAssistantDesignAction: mocks.createAssistantDesignAction,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

import { FloatingAssistantWidget } from '@/components/chat/FloatingAssistantWidget';

describe('FloatingAssistantWidget (Meta AI WhatsApp style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/home';
  });

  it('renders the floating circular button (FAB) when not on /assistant page', () => {
    render(<FloatingAssistantWidget />);
    const button = screen.getByRole('button', { name: /toggle style assistant/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the floating button when user is already on the dedicated /assistant page', () => {
    mocks.pathname = '/assistant';
    const { container } = render(<FloatingAssistantWidget />);
    expect(container.firstChild).toBeNull();
  });

  it('clicking the button toggles the floating chat dialog', async () => {
    const user = userEvent.setup();
    render(<FloatingAssistantWidget />);

    const button = screen.getByRole('button', { name: /toggle style assistant/i });
    await user.click(button);

    expect(screen.getByRole('dialog', { name: /style assistant chat/i })).toBeInTheDocument();
    expect(screen.getByText('Ask your stylist')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ask your stylist...')).toBeInTheDocument();
  });

  it('clicking a suggestion chip sends the message to the assistant', async () => {
    const user = userEvent.setup();
    const replyConversation: ChatConversation = {
      id: '64b7f0c2a1b2c3d4e5f60718',
      title: 'What should I wear to a sangeet?',
      updatedAt: '2026-10-24T10:00:00.000Z',
      messages: [
        {
          id: '1',
          role: 'user',
          text: 'What should I wear to a sangeet?',
          intent: null,
          cards: [],
          links: [],
          wording: null,
          createdAt: '2026-10-24T10:00:00.000Z',
        },
        {
          id: '2',
          role: 'assistant',
          text: 'For a sangeet, an embroidered kurta or fusion bandhgala in jewel tones works wonderfully.',
          intent: 'looks',
          cards: [],
          links: [{ label: 'Explore complete outfits', href: '/discover/looks' }],
          wording: 'fixed',
          createdAt: '2026-10-24T10:00:01.000Z',
        },
      ],
    };

    mocks.sendAssistantMessageAction.mockResolvedValueOnce({ conversation: replyConversation });

    render(<FloatingAssistantWidget />);
    await user.click(screen.getByRole('button', { name: /toggle style assistant/i }));

    const suggestion = screen.getByText(/What should I wear to a sangeet\?/i);
    await user.click(suggestion);

    expect(mocks.sendAssistantMessageAction).toHaveBeenCalledWith('What should I wear to a sangeet?', undefined);

    await waitFor(() => {
      expect(screen.getByText(/For a sangeet, an embroidered kurta or fusion bandhgala/i)).toBeInTheDocument();
      expect(screen.getByText('Explore complete outfits →')).toBeInTheDocument();
    });
  });

  it('close button in header dismisses the floating dialog', async () => {
    const user = userEvent.setup();
    render(<FloatingAssistantWidget />);

    await user.click(screen.getByRole('button', { name: /toggle style assistant/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close assistant/i });
    await user.click(closeBtn);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
