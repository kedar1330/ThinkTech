// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { slotAlternativeSchema, type SlotAlternative } from '@styleme/contracts';
import { SearchPhrase } from '@/components/outfits/SearchPhrase';
import { SlotAlternatives } from '@/components/outfits/SlotAlternatives';
import { WhyThisWorks } from '@/components/outfits/WhyThisWorks';

// Synthetic alternatives, parsed by the contract.
const COLOURS = [
  { colorId: 'navy', name: 'Navy', hex: '#1F2A44' },
  { colorId: 'mustard', name: 'Mustard', hex: '#D4A017' },
  { colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' },
] as const;

function alternatives(n: number): SlotAlternative[] {
  return Array.from({ length: n }, (_, i) => {
    const colour = COLOURS[i % COLOURS.length]!;
    return slotAlternativeSchema.parse({
      lookSpec: {
        category: 'kurta',
        colorFamily: colour.colorId === 'ivory' ? 'neutral' : colour.colorId === 'navy' ? 'blue' : 'yellow',
        colorId: colour.colorId,
        fabric: i % 2 ? 'linen' : 'cotton',
      },
      swatches: [colour],
      searchPhrase: `${colour.name.toLowerCase()} kurta option ${i + 1}`,
    });
  });
}

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

describe('slot alternatives (AC-12, D-53)', () => {
  it('lists 3 alternatives without a limited message', () => {
    render(<SlotAlternatives alternatives={alternatives(3)} />);
    expect(screen.getByText('3 alternatives')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Alternatives', hidden: true });
    expect(list.children).toHaveLength(3);
    expect(screen.queryByText(/suitable alternatives? (was|were) found/)).not.toBeInTheDocument();
  });

  it('shows at most 5', () => {
    render(<SlotAlternatives alternatives={alternatives(7)} />);
    expect(screen.getByText('5 alternatives')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Alternatives', hidden: true }).children).toHaveLength(5);
  });

  it('shows what each alternative is: garment, colours, hints and a search phrase', () => {
    render(<SlotAlternatives alternatives={alternatives(3)} />);
    const [first] = [...screen.getByRole('list', { name: 'Alternatives', hidden: true }).children] as HTMLElement[];
    expect(first).toHaveTextContent('Kurta');
    expect(first).toHaveTextContent('Navy');
    expect(first).toHaveTextContent('Cotton');
    expect(first).toHaveTextContent('Search for: navy kurta option 1');
  });

  it('shows only what the engine returned when fewer than 3, with the limited message (ALTERNATIVES_LIMITED)', () => {
    render(<SlotAlternatives alternatives={alternatives(2)} />);
    expect(screen.getByText('2 alternatives')).toBeInTheDocument();
    expect(screen.getByText('Only 2 suitable alternatives were found for this item.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Alternatives', hidden: true }).children).toHaveLength(2);
  });

  it('says so when there are none', () => {
    render(<SlotAlternatives alternatives={[]} />);
    expect(screen.getByText('No alternatives for this item yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { hidden: true })).not.toBeInTheDocument();
  });

  // A native <details>: browsers open it with Enter or Space on the focused summary (jsdom doesn't simulate that).
  it('is a native disclosure reachable with the keyboard', async () => {
    const user = userEvent.setup();
    render(<SlotAlternatives alternatives={alternatives(3)} />);
    await user.tab();
    const summary = screen.getByText('3 alternatives');
    expect(summary).toHaveFocus();
    expect(summary.tagName).toBe('SUMMARY');
    expect(summary.parentElement?.tagName).toBe('DETAILS');
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
