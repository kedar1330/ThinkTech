// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SearchPhrase } from '@/components/outfits/SearchPhrase';
import { WhyThisWorks } from '@/components/outfits/WhyThisWorks';

describe('Why this works (AC-11)', () => {
  const EXPLANATION =
    'A maroon kurta with ivory trousers: warm colours suit festive occasions — and cotton keeps it light.';

  it('shows the explanation exactly as the engine returned it, open by default', () => {
    render(<WhyThisWorks explanation={EXPLANATION} />);
    expect(screen.getByText('Why this works')).toBeInTheDocument();
    expect(screen.getByText(EXPLANATION)).toBeVisible();
    expect(screen.getByText('Why this works').closest('details')).toHaveAttribute('open');
  });

  it('can be reached with the keyboard', async () => {
    const user = userEvent.setup();
    render(<WhyThisWorks explanation={EXPLANATION} />);
    await user.tab();
    expect(screen.getByText('Why this works')).toHaveFocus();
  });
});

describe('search phrase (FR-LOOK-15)', () => {
  it('shows the phrase and the store note', () => {
    render(<SearchPhrase phrase="maroon cotton kurta" />);
    expect(screen.getByText(/Search for:/)).toHaveTextContent('Search for: maroon cotton kurta');
    expect(screen.getByText('Search for this style at a store of your choice.')).toBeInTheDocument();
  });

  it('copies the phrase and announces it to screen readers', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<SearchPhrase phrase="maroon cotton kurta" />);
    const button = screen.getByRole('button', { name: 'Copy search phrase: maroon cotton kurta' });
    await user.click(button);

    expect(writeText).toHaveBeenCalledWith('maroon cotton kurta');
    const live = screen.getByText('Copied');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('can be copied with the keyboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<SearchPhrase phrase="ivory straight trousers" />);
    await user.tab();
    expect(screen.getByRole('button', { name: /Copy search phrase/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(writeText).toHaveBeenCalledWith('ivory straight trousers');
  });

  it('says so when copying fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    render(<SearchPhrase phrase="navy kurta" />);
    await user.click(screen.getByRole('button', { name: /Copy search phrase/ }));
    expect(await screen.findByText('Could not copy. Select the text to copy it.')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});
