// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DEFAULT_MANUAL_STEPS } from '@styleme/contracts';
import { HowItWorksManual } from '../components/home/HowItWorksManual';

describe('HowItWorksManual (Home Page Website Manual)', () => {
  it('renders all 8 workflow steps in order', () => {
    render(<HowItWorksManual steps={DEFAULT_MANUAL_STEPS} />);

    expect(
      screen.getByRole('heading', { level: 2, name: /How StyleMe Works: Your Complete Guide/i }),
    ).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'StyleMe workflow steps' });
    expect(within(nav).getByRole('button', { name: /Colour Palette/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Outfit Categories/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Curated Look/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Shop Your Look/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Virtual Try-On/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Design Studio/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Style Assistant/i })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Saved Outfits/i })).toBeInTheDocument();
  });

  it('allows clicking tabs to switch active step in walkthrough mode', async () => {
    const user = userEvent.setup();
    render(<HowItWorksManual steps={DEFAULT_MANUAL_STEPS} />);

    // Initially Step 1 is active
    expect(screen.getByRole('heading', { level: 3, name: /1\. Discover Your Colour Palette/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Colour Palettes/i })).toHaveAttribute('href', '/palette');

    // Click step 6: Design Studio
    const tab6 = screen.getByRole('button', { name: /Design Studio/i });
    await user.click(tab6);

    expect(screen.getByRole('heading', { level: 3, name: /6\. Bespoke Design Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Explore Design Studio/i })).toHaveAttribute(
      'href',
      '/features/design-studio',
    );
  });

  it('navigates next and previous steps with buttons', async () => {
    const user = userEvent.setup();
    render(<HowItWorksManual steps={DEFAULT_MANUAL_STEPS} />);

    expect(screen.getByRole('heading', { level: 3, name: /1\. Discover Your Colour Palette/i })).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Next step/i });
    await user.click(nextBtn);

    expect(screen.getByRole('heading', { level: 3, name: /2\. Explore Outfit Categories/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse Categories/i })).toHaveAttribute('href', '/categories');

    const prevBtn = screen.getByRole('button', { name: /Previous step/i });
    await user.click(prevBtn);

    expect(screen.getByRole('heading', { level: 3, name: /1\. Discover Your Colour Palette/i })).toBeInTheDocument();
  });

  it('switches to All 8 Steps grid view mode', async () => {
    const user = userEvent.setup();
    render(<HowItWorksManual steps={DEFAULT_MANUAL_STEPS} />);

    const gridBtn = screen.getByRole('button', { name: /All 8 Steps/i });
    await user.click(gridBtn);

    // All 8 cards are shown simultaneously
    expect(screen.getByRole('heading', { level: 3, name: /Discover Your Colour Palette/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Explore Outfit Categories/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Discover Your Curated Look/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Shop Your Look/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Virtual Try-On Experience/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Bespoke Design Studio/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /AI Style Assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Saved Outfits & Digital Wardrobe/i })).toBeInTheDocument();
  });
});
