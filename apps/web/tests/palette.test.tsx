// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paletteListResponseSchema, paletteSummarySchema, type PaletteSummary } from '@styleme/contracts';
import { ColourSwatch } from '@/components/palette/ColourSwatch';
import { PaletteCard } from '@/components/palette/PaletteCard';
import { PaletteDetail } from '@/components/palette/PaletteDetail';
import { ViewToggle } from '@/components/palette/ViewToggle';
import { WhyThesePalettes } from '@/components/palette/WhyThesePalettes';
import { contrastLevelLabel, paletteFamilies, relativeLuminance, textContrastColor } from '@/lib/palette/palette-utils';

// Mocks for server page tests
const serverMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  requireOnboarded: vi.fn().mockResolvedValue({ accessToken: 'test-token', user: { _id: 'u1' } }),
  notFound: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({
  apiRequest: serverMocks.apiRequest,
}));

vi.mock('@/lib/auth/session', () => ({
  requireOnboarded: serverMocks.requireOnboarded,
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    serverMocks.notFound();
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import PalettePage from '@/app/(app)/palette/page';
import PaletteDetailPage from '@/app/(app)/palette/[id]/page';

// Validated fixture data parsed by the contract schema (FR-PAL-01 … 03).
const FIXTURE_PALETTE: PaletteSummary = paletteSummarySchema.parse({
  id: 'PAL-001',
  name: 'Warm earth',
  neutrals: [
    { colorId: 'cream', name: 'Cream', hex: '#F2E8CF' },
    { colorId: 'tan', name: 'Tan', hex: '#C69C6D' },
    { colorId: 'chocolate', name: 'Chocolate', hex: '#5B3A29' },
  ],
  accents: [
    { colorId: 'rust', name: 'Rust', hex: '#B7410E' },
    { colorId: 'mustard', name: 'Mustard', hex: '#D4A017' },
    { colorId: 'olive', name: 'Olive', hex: '#708238' },
  ],
  combinations: [
    {
      colors: [
        { colorId: 'tan', name: 'Tan', hex: '#C69C6D' },
        { colorId: 'mustard', name: 'Mustard', hex: '#D4A017' },
      ],
      contrastLevel: 'low',
    },
    {
      colors: [
        { colorId: 'cream', name: 'Cream', hex: '#F2E8CF' },
        { colorId: 'tan', name: 'Tan', hex: '#C69C6D' },
        { colorId: 'rust', name: 'Rust', hex: '#B7410E' },
      ],
      contrastLevel: 'medium',
    },
    {
      colors: [
        { colorId: 'cream', name: 'Cream', hex: '#F2E8CF' },
        { colorId: 'chocolate', name: 'Chocolate', hex: '#5B3A29' },
      ],
      contrastLevel: 'high',
    },
  ],
  rationale:
    'Groups warm, yellow-based earth tones (cream, tan, chocolate, rust, mustard and olive), so every combination shares the same warm cast and reads as one coordinated look.',
  limitations:
    'Offered first when a user reports a warm undertone, but anyone can browse and choose it; undertone affinity is a starting suggestion, never a restriction. Swatch colours approximate the named colours and are not product colours.',
  suggestedBecause: ['undertone', 'skinTone'],
});

const FIXTURE_PALETTE_2: PaletteSummary = paletteSummarySchema.parse({
  id: 'PAL-002',
  name: 'Cool coastal',
  neutrals: [
    { colorId: 'white', name: 'White', hex: '#FFFFFF' },
    { colorId: 'grey', name: 'Grey', hex: '#8C8C8C' },
    { colorId: 'navy', name: 'Navy', hex: '#1F2A44' },
  ],
  accents: [
    { colorId: 'powder_blue', name: 'Powder blue', hex: '#B0C4DE' },
    { colorId: 'sky_blue', name: 'Sky blue', hex: '#87CEEB' },
    { colorId: 'lavender', name: 'Lavender', hex: '#C7B8E0' },
  ],
  combinations: [
    {
      colors: [
        { colorId: 'powder_blue', name: 'Powder blue', hex: '#B0C4DE' },
        { colorId: 'lavender', name: 'Lavender', hex: '#C7B8E0' },
      ],
      contrastLevel: 'low',
    },
    {
      colors: [
        { colorId: 'white', name: 'White', hex: '#FFFFFF' },
        { colorId: 'navy', name: 'Navy', hex: '#1F2A44' },
      ],
      contrastLevel: 'high',
    },
  ],
  rationale:
    'Pairs crisp white, grey and navy with soft blues and lavender. The shared cool, blue-based cast keeps combinations calm.',
  limitations: 'Offered first when a user reports a cool undertone, but anyone can browse and choose it.',
  suggestedBecause: [],
});

const FIXTURES_RESPONSE = paletteListResponseSchema.parse({
  palettes: [FIXTURE_PALETTE, FIXTURE_PALETTE_2],
});

describe('ColourSwatch component', () => {
  it('every swatch has a text label (never colour alone) and readable name', () => {
    const swatch = { colorId: 'cream' as const, name: 'Cream', hex: '#F2E8CF' };
    const { container } = render(<ColourSwatch swatch={swatch} size="sm" />);
    expect(screen.getByText('Cream')).toBeInTheDocument();
    // Swatch container has text content, never colour alone
    expect(container.textContent?.trim()).toBe('Cream');
  });

  it('calculates contrast-aware text color for light vs dark swatches', () => {
    // Light swatch (Cream): needs dark text
    const cream = { colorId: 'cream' as const, name: 'Cream', hex: '#F2E8CF' };
    expect(relativeLuminance(cream.hex)).toBeGreaterThan(0.179);
    expect(textContrastColor(cream.hex)).toBe('#1A1A1A');

    // Dark swatch (Chocolate): needs light text
    const chocolate = { colorId: 'chocolate' as const, name: 'Chocolate', hex: '#5B3A29' };
    expect(relativeLuminance(chocolate.hex)).toBeLessThan(0.179);
    expect(textContrastColor(chocolate.hex)).toBe('#FFFFFF');

    // Dark navy
    expect(textContrastColor('#1F2A44')).toBe('#FFFFFF');
    // Crisp white
    expect(textContrastColor('#FFFFFF')).toBe('#1A1A1A');
  });

  it('renders large variant with readable name, hex code, and role label', () => {
    const swatch = { colorId: 'rust' as const, name: 'Rust', hex: '#B7410E' };
    render(<ColourSwatch swatch={swatch} size="lg" roleLabel="Accent" showHex />);
    expect(screen.getAllByText('Rust').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('#B7410E').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Accent').length).toBeGreaterThanOrEqual(1);
  });

  it('renders medium variant with name, hex, and role', () => {
    const swatch = { colorId: 'mustard' as const, name: 'Mustard', hex: '#D4A017' };
    render(<ColourSwatch swatch={swatch} size="md" roleLabel="Accent" />);
    expect(screen.getByText('Mustard')).toBeInTheDocument();
    expect(screen.getByText('#D4A017')).toBeInTheDocument();
    expect(screen.getByText('Accent')).toBeInTheDocument();
  });
});

describe('PaletteCard component', () => {
  it('renders name, family, all swatches with text labels, and links to detail page', () => {
    render(<PaletteCard palette={FIXTURE_PALETTE} />);

    // Name links to detail page
    const link = screen.getByRole('link', { name: 'Warm earth' });
    expect(link).toHaveAttribute('href', '/palette/PAL-001');

    // Family is displayed
    const families = paletteFamilies(FIXTURE_PALETTE);
    expect(families.length).toBeGreaterThan(0);
    expect(screen.getByText(families.join(' · '))).toBeInTheDocument();

    // Rationale
    expect(screen.getByText(FIXTURE_PALETTE.rationale)).toBeInTheDocument();

    // All 5–8 swatches are present with text labels (never colour alone)
    const allSwatches = [...FIXTURE_PALETTE.neutrals, ...FIXTURE_PALETTE.accents];
    expect(allSwatches.length).toBe(6);
    for (const swatch of allSwatches) {
      expect(screen.getByText(swatch.name)).toBeInTheDocument();
    }

    // Number of combinations
    expect(screen.getByText('3 combinations')).toBeInTheDocument();

    // Secondary link
    const viewLink = screen.getByRole('link', { name: 'View palette →' });
    expect(viewLink).toHaveAttribute('href', '/palette/PAL-001');
  });

  it('liked colours are never hidden (FR-PAL-03) on the card', () => {
    render(<PaletteCard palette={FIXTURE_PALETTE} />);
    // Every accent and neutral swatch is rendered
    expect(screen.getByText('Cream')).toBeInTheDocument();
    expect(screen.getByText('Tan')).toBeInTheDocument();
    expect(screen.getByText('Chocolate')).toBeInTheDocument();
    expect(screen.getByText('Rust')).toBeInTheDocument();
    expect(screen.getByText('Mustard')).toBeInTheDocument();
    expect(screen.getByText('Olive')).toBeInTheDocument();
  });

  it('renders rationale badges as returned by the API when suggestedBecause is present', () => {
    render(<PaletteCard palette={FIXTURE_PALETTE} />);
    expect(screen.getByText('undertone')).toBeInTheDocument();
    expect(screen.getByText('skinTone')).toBeInTheDocument();
  });

  it('renders custom rationale like "Includes 3 of your liked colours" as returned by the API', () => {
    const customPalette: PaletteSummary = {
      ...FIXTURE_PALETTE,
      suggestedBecause: ['Includes 3 of your liked colours'],
    };
    render(<PaletteCard palette={customPalette} />);
    expect(screen.getByText('Includes 3 of your liked colours')).toBeInTheDocument();
  });

  it('omits recommendation rationale badges when suggestedBecause is empty (view=all)', () => {
    render(<PaletteCard palette={FIXTURE_PALETTE_2} />);
    expect(screen.queryByLabelText('Why this is recommended')).toBeNull();
  });
});

describe('ViewToggle component', () => {
  it('renders Recommended for You and Explore All Palettes links with correct URLs', () => {
    render(<ViewToggle currentView="suggested" />);
    const suggestedLink = screen.getByRole('link', { name: 'Recommended for You' });
    const allLink = screen.getByRole('link', { name: 'Explore All Palettes' });

    expect(suggestedLink).toHaveAttribute('href', '/palette?view=suggested');
    expect(allLink).toHaveAttribute('href', '/palette?view=all');
    expect(suggestedLink).toHaveAttribute('aria-current', 'page');
    expect(allLink).not.toHaveAttribute('aria-current');
  });

  it('marks Explore All Palettes as active when currentView is all', () => {
    render(<ViewToggle currentView="all" />);
    const suggestedLink = screen.getByRole('link', { name: 'Recommended for You' });
    const allLink = screen.getByRole('link', { name: 'Explore All Palettes' });

    expect(suggestedLink).not.toHaveAttribute('aria-current');
    expect(allLink).toHaveAttribute('aria-current', 'page');
  });
});

describe('WhyThesePalettes component', () => {
  it('shows personalised factors when both signals and preferences are present', () => {
    render(<WhyThesePalettes palettes={[FIXTURE_PALETTE]} view="suggested" />);
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByText('Personalised for you')).toBeInTheDocument();
    expect(screen.getByText('Undertone suitability')).toBeInTheDocument();
    expect(screen.getByText('Skin tone suitability')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('with appearance signals off, never uses signals and explains so with fallback label (T-10, FR-PAL-07)', () => {
    const signalsOffPalette: PaletteSummary = {
      ...FIXTURE_PALETTE,
      suggestedBecause: ['likedColors'],
    };
    render(<WhyThesePalettes palettes={[signalsOffPalette]} view="suggested" />);
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
    expect(screen.getByText(/Appearance signals \(skin tone and undertone\) are not used/)).toBeInTheDocument();
    // Signals are never used or cited in the factors list
    expect(screen.queryByText('Undertone suitability')).toBeNull();
    expect(screen.queryByText('Skin tone suitability')).toBeNull();
    expect(screen.getByText('Liked colours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('shows fallback explanation with "General, not personalised" label when preferences/signals missing (FR-PAL-07)', () => {
    const unrankedPalette: PaletteSummary = {
      ...FIXTURE_PALETTE,
      suggestedBecause: [],
    };
    render(<WhyThesePalettes palettes={[unrankedPalette]} view="suggested" />);
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
    expect(screen.getByText(/Colour preferences and appearance signals are missing/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('honours explicit isFallback prop override', () => {
    render(<WhyThesePalettes palettes={[FIXTURE_PALETTE]} view="suggested" isFallback={true} />);
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('shows catalog explanation when view is all', () => {
    render(<WhyThesePalettes palettes={[FIXTURE_PALETTE]} view="all" />);
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
    expect(screen.getByText(/Showing all approved colour palettes in standard catalog order/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });
});

describe('PaletteDetail component', () => {
  it('renders large swatches, colour names, hex codes, coordinating colours, and combinations with contrast labels', () => {
    render(<PaletteDetail palette={FIXTURE_PALETTE} />);

    // Title and back link
    expect(screen.getByRole('heading', { level: 1, name: 'Warm earth' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Back to palettes' })).toHaveAttribute('href', '/palette');

    // Rationale and limitations
    expect(screen.getByText(FIXTURE_PALETTE.rationale)).toBeInTheDocument();
    expect(screen.getByText(FIXTURE_PALETTE.limitations)).toBeInTheDocument();

    // Large swatches section
    expect(screen.getByRole('heading', { level: 2, name: 'Palette colours' })).toBeInTheDocument();
    const largeList = screen.getByRole('list', { name: 'Large colour swatches' });
    for (const swatch of [...FIXTURE_PALETTE.neutrals, ...FIXTURE_PALETTE.accents]) {
      expect(within(largeList).getAllByText(swatch.name).length).toBeGreaterThanOrEqual(1);
      expect(within(largeList).getAllByText(swatch.hex).length).toBeGreaterThanOrEqual(1);
    }

    // Coordinating colours section
    expect(screen.getByRole('heading', { level: 2, name: 'Coordinating colours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Foundation neutrals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Coordinating accents' })).toBeInTheDocument();

    // Curated combinations with contrast labels
    expect(screen.getByRole('heading', { level: 2, name: 'Curated combinations' })).toBeInTheDocument();
    expect(screen.getByText(contrastLevelLabel('low'))).toBeInTheDocument();
    expect(screen.getByText(contrastLevelLabel('medium'))).toBeInTheDocument();
    expect(screen.getByText(contrastLevelLabel('high'))).toBeInTheDocument();

    // Ranking tags if suggestedBecause is present
    expect(screen.getByText('undertone')).toBeInTheDocument();
    expect(screen.getByText('skinTone')).toBeInTheDocument();
  });
});

describe('Palette pages (server components)', () => {
  beforeEach(() => {
    serverMocks.apiRequest.mockReset();
    serverMocks.notFound.mockReset();
  });

  it('renders grid of palette cards on /palette (view=suggested default)', async () => {
    serverMocks.apiRequest.mockResolvedValue(FIXTURES_RESPONSE);

    const page = await PalettePage();
    render(page);

    expect(serverMocks.apiRequest).toHaveBeenCalledWith('/v1/style/palettes?view=suggested', {
      token: 'test-token',
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Curated colour palettes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Recommended for You' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Explore All Palettes' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Why am I seeing these?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Warm earth' })).toHaveAttribute('href', '/palette/PAL-001');
    expect(screen.getByRole('link', { name: 'Cool coastal' })).toHaveAttribute('href', '/palette/PAL-002');
  });

  it('renders view=all when requested via searchParams', async () => {
    serverMocks.apiRequest.mockResolvedValue(FIXTURES_RESPONSE);

    const page = await PalettePage({ searchParams: Promise.resolve({ view: 'all' }) });
    render(page);

    expect(serverMocks.apiRequest).toHaveBeenCalledWith('/v1/style/palettes?view=all', {
      token: 'test-token',
    });
    expect(screen.getByRole('link', { name: 'Explore All Palettes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Recommended for You' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
  });

  it('with appearance signals off, ranking never uses signals in UI (FR-PAL-06, T-10)', async () => {
    const signalsOffResponse = {
      palettes: [{ ...FIXTURE_PALETTE, suggestedBecause: ['likedColors'] }],
    };
    serverMocks.apiRequest.mockResolvedValue(signalsOffResponse);

    const page = await PalettePage({ searchParams: Promise.resolve({ view: 'suggested' }) });
    render(page);

    expect(screen.getByText(/Appearance signals \(skin tone and undertone\) are not used/)).toBeInTheDocument();
    expect(screen.queryByText('Undertone suitability')).toBeNull();
    expect(screen.queryByText('Skin tone suitability')).toBeNull();
    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
  });

  it('shows fallback explanation and "General, not personalised" label when preferences are missing (FR-PAL-07)', async () => {
    const fallbackResponse = {
      palettes: [{ ...FIXTURE_PALETTE, suggestedBecause: [] }],
    };
    serverMocks.apiRequest.mockResolvedValue(fallbackResponse);

    const page = await PalettePage({ searchParams: Promise.resolve({ view: 'suggested' }) });
    render(page);

    expect(screen.getByText('General, not personalised')).toBeInTheDocument();
    expect(screen.getByText(/Colour preferences and appearance signals are missing/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('shows honest empty state while no palettes are approved; never placeholders', async () => {
    serverMocks.apiRequest.mockResolvedValue({
      palettes: [],
    });

    const page = await PalettePage();
    render(page);

    expect(screen.getByText('No approved palettes yet')).toBeInTheDocument();
    expect(screen.getByText(/No colour palettes have been approved by our styling team yet/)).toBeInTheDocument();
    // No mock cards or placeholder links are rendered
    expect(screen.queryByRole('link', { name: /palette/i })).toBeNull();
  });

  it('renders detail view on /palette/[id] for existing palette', async () => {
    serverMocks.apiRequest.mockResolvedValue(FIXTURES_RESPONSE);

    const page = await PaletteDetailPage({ params: Promise.resolve({ id: 'PAL-001' }) });
    render(page);

    expect(screen.getByRole('heading', { level: 1, name: 'Warm earth' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Palette colours' })).toBeInTheDocument();
  });

  it('calls notFound() on /palette/[id] for an unknown ID', async () => {
    serverMocks.apiRequest.mockResolvedValue({
      palettes: [FIXTURE_PALETTE],
    });

    await expect(PaletteDetailPage({ params: Promise.resolve({ id: 'PAL-999' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(serverMocks.notFound).toHaveBeenCalled();
  });
});
