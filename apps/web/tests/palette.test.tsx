// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ColourCombination, MyColourCombinationsResponse, MyColoursResponse } from '@styleme/contracts';
import { CombinationGallery } from '@/components/colours/CombinationGallery';
import { CoordinatingColours } from '@/components/colours/CoordinatingColours';
import { relativeLuminance, textContrastColor } from '@/lib/palette/palette-utils';

// My Colour Palette (#105): only the user's own colours, with coordinating colours and curated combinations.
// The generic curated palette cards are gone.

const serverMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  requireOnboarded: vi.fn().mockResolvedValue({ accessToken: 'test-token', user: { _id: 'u1' } }),
  redirect: vi.fn(),
}));

vi.mock('@/lib/api/server', () => ({ apiRequest: serverMocks.apiRequest, ApiError: class extends Error {} }));
vi.mock('@/lib/auth/session', () => ({ requireOnboarded: serverMocks.requireOnboarded }));
vi.mock('@/app/actions/colours', () => ({ setColourPreferenceAction: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    serverMocks.redirect(url);
    throw new Error('NEXT_REDIRECT');
  },
}));

import PalettePage from '@/app/(app)/palette/page';
import PaletteDetailPage from '@/app/(app)/palette/[id]/page';
import MyColoursPage from '@/app/(app)/palette/colours/page';

const MINE: MyColoursResponse = {
  missing: null,
  category: {
    categoryId: 'monk-06-warm',
    monkTone: 6,
    undertone: 'warm',
    label: 'Monk 6 · Warm',
    colourCount: 120,
    preview: [
      { name: 'Rust', hex: '#A8432A' },
      { name: 'Teal', hex: '#1F7A72' },
      { name: 'Cream', hex: '#F2E8CF' },
    ],
    skinHex: '#A26E4E',
    rationale: 'Earthy, warm hues echo a warm undertone.',
    limitations: 'A starting point, not a rule.',
    reviewStatus: 'approved',
  },
  families: [],
  colours: [],
  saved: { liked: 2, avoided: 1 },
};

const OWN = [
  { colourId: 'CLR-0001', name: 'Rust', hex: '#A8432A', family: 'orange', preference: null },
  { colourId: 'CLR-0002', name: 'Teal', hex: '#1F7A72', family: 'teal', preference: 'liked' },
  { colourId: 'CLR-0003', name: 'Cream', hex: '#F2E8CF', family: 'beige', preference: null },
  { colourId: 'CLR-0004', name: 'Mustard', hex: '#C9A227', family: 'yellow', preference: null },
] satisfies MyColourCombinationsResponse['colours'];

function combo(id: string, harmony: ColourCombination['harmony'], ids: string[], likedCount = 0): ColourCombination {
  const roles = ['base', 'accent', 'pop'] as const;
  return {
    combinationId: id,
    harmony,
    colours: ids.map((colourId, i) => {
      const c = OWN.find((o) => o.colourId === colourId)!;
      return { colourId, name: c.name, hex: c.hex, role: roles[i]!, preference: c.preference };
    }),
    score: 90,
    reason: 'Opposite hues on the colour wheel make each other stand out.',
    likedCount,
  };
}

const COMBOS: MyColourCombinationsResponse = {
  missing: null,
  colours: OWN,
  harmonies: [
    { id: 'neutral_accent', label: 'Neutral and accent', count: 1 },
    { id: 'complementary', label: 'Complementary', count: 1 },
  ],
  combinations: [
    combo('CMB-0001-0002', 'complementary', ['CLR-0001', 'CLR-0002'], 1),
    combo('CMB-0003-0004', 'neutral_accent', ['CLR-0003', 'CLR-0004']),
  ],
  coordinating: [
    { colourId: 'CLR-0001', matches: ['CLR-0002', 'CLR-0003'] },
    { colourId: 'CLR-0002', matches: ['CLR-0004'] },
    { colourId: 'CLR-0003', matches: [] },
    { colourId: 'CLR-0004', matches: ['CLR-0002'] },
  ],
  generatedAt: '2026-10-22T12:00:00.000Z',
};

beforeEach(() => {
  serverMocks.apiRequest.mockReset();
  serverMocks.redirect.mockReset();
});

describe('palette utilities', () => {
  it('picks readable text for light and dark swatches', () => {
    expect(relativeLuminance('#F2E8CF')).toBeGreaterThan(0.179);
    expect(textContrastColor('#F2E8CF')).toBe('#1A1A1A');
    expect(relativeLuminance('#5B3A29')).toBeLessThan(0.179);
    expect(textContrastColor('#5B3A29')).toBe('#FFFFFF');
    expect(textContrastColor('#FFFFFF')).toBe('#1A1A1A');
  });
});

describe('My Colour Palette page', () => {
  it('shows only the user’s own colours: no curated palette cards', async () => {
    serverMocks.apiRequest.mockResolvedValue(MINE);
    render(await PalettePage());
    expect(serverMocks.apiRequest).toHaveBeenCalledWith('/v1/colours/mine', { token: 'test-token' });
    expect(serverMocks.apiRequest).not.toHaveBeenCalledWith(
      expect.stringContaining('/v1/style/palettes'),
      expect.anything(),
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Your colours' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Palette view' })).toBeNull();
    expect(screen.queryByText(/Warm earth|Festive warm brights/i)).toBeNull();

    expect(screen.getByRole('link', { name: /See my colours/ })).toHaveAttribute('href', '/palette/colours');
    expect(screen.getByRole('link', { name: /Find matches/ })).toHaveAttribute(
      'href',
      '/palette/colours?view=coordinating',
    );
    expect(screen.getByRole('link', { name: /See combinations/ })).toHaveAttribute(
      'href',
      '/palette/colours?view=combinations',
    );
  });

  it('keeps “Why am I seeing these?”, explained by the user’s own skin tone and choices', async () => {
    serverMocks.apiRequest.mockResolvedValue(MINE);
    render(await PalettePage());
    const why = screen.getByRole('region', { name: 'Why am I seeing these?' });
    expect(within(why).getByText('Personalised for you')).toBeInTheDocument();
    expect(within(why).getByText('Monk 6 · Warm')).toBeInTheDocument();
    expect(
      within(why).getByText(/2 colours you like come first, and the colour you avoid is left out/),
    ).toBeInTheDocument();
    expect(within(why).getByRole('link', { name: 'Change in My Profile' })).toHaveAttribute('href', '/profile');
  });

  it('says what is missing when there is no skin tone yet', async () => {
    serverMocks.apiRequest.mockResolvedValue({
      ...MINE,
      missing: 'skin_tone',
      category: null,
      saved: { liked: 0, avoided: 0 },
    });
    render(await PalettePage());
    const why = screen.getByRole('region', { name: 'Why am I seeing these?' });
    expect(within(why).getByText('Not personalised yet')).toBeInTheDocument();
    expect(within(why).getByText(/Choose your skin tone in My Profile/)).toBeInTheDocument();
    expect(within(why).getByRole('link', { name: 'Go to My Profile' })).toHaveAttribute('href', '/profile');
  });

  it('sends old palette links back to My Colour Palette', () => {
    expect(() => PaletteDetailPage()).toThrow('NEXT_REDIRECT');
    expect(serverMocks.redirect).toHaveBeenCalledWith('/palette');
  });
});

describe('My colours views', () => {
  const route = (url: string) => (url === '/v1/colours/mine' ? MINE : COMBOS);

  it('loads combinations only on the combinations and coordinating views', async () => {
    serverMocks.apiRequest.mockImplementation(async (url: string) => route(url));
    render(await MyColoursPage({ searchParams: Promise.resolve({}) }));
    expect(serverMocks.apiRequest).toHaveBeenCalledTimes(1);
    const nav = screen.getByRole('navigation', { name: 'My colours views' });
    expect(within(nav).getByRole('link', { name: 'All my colours' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows curated combinations', async () => {
    serverMocks.apiRequest.mockImplementation(async (url: string) => route(url));
    render(await MyColoursPage({ searchParams: Promise.resolve({ view: 'combinations' }) }));
    expect(serverMocks.apiRequest).toHaveBeenCalledWith('/v1/colours/combinations', { token: 'test-token' });
    expect(screen.getByRole('link', { name: 'Combinations' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('article', { name: 'Rust, Teal' })).toBeInTheDocument();
  });

  it('shows coordinating colours', async () => {
    serverMocks.apiRequest.mockImplementation(async (url: string) => route(url));
    render(await MyColoursPage({ searchParams: Promise.resolve({ view: 'coordinating' }) }));
    expect(screen.getByRole('radiogroup', { name: 'Your colours' })).toBeInTheDocument();
  });

  it('explains what is missing instead of loading combinations', async () => {
    serverMocks.apiRequest.mockResolvedValue({ ...MINE, missing: 'undertone', category: null });
    render(await MyColoursPage({ searchParams: Promise.resolve({ view: 'combinations' }) }));
    expect(serverMocks.apiRequest).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Add your undertone to see your colours')).toBeInTheDocument();
  });
});

describe('CombinationGallery', () => {
  it('shows each combination’s colours, roles, hex codes and reason', () => {
    render(<CombinationGallery combinations={COMBOS.combinations} harmonies={COMBOS.harmonies} />);
    const card = screen.getByRole('article', { name: 'Rust, Teal' });
    expect(within(card).getByText('Complementary')).toBeInTheDocument();
    expect(within(card).getByText('Base · #A8432A')).toBeInTheDocument();
    expect(within(card).getByText('Accent · #1F7A72')).toBeInTheDocument();
    expect(within(card).getByLabelText('liked')).toBeInTheDocument();
    expect(within(card).getByText(/Opposite hues/)).toBeInTheDocument();
  });

  it('filters by harmony and by liked colours', () => {
    render(<CombinationGallery combinations={COMBOS.combinations} harmonies={COMBOS.harmonies} />);
    fireEvent.click(screen.getByRole('button', { name: /Neutral and accent/ }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Cream, Mustard' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /With colours I like/ }));
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.getByText('No combinations match these filters.')).toBeInTheDocument();
  });

  it('shows more on request', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...COMBOS.combinations[0]!, combinationId: `CMB-${i}` }));
    render(
      <CombinationGallery
        combinations={many}
        harmonies={[{ id: 'complementary', label: 'Complementary', count: 30 }]}
      />,
    );
    expect(screen.getAllByRole('article')).toHaveLength(24);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Show more (6 left)' }));
    });
    expect(screen.getAllByRole('article')).toHaveLength(30);
  });
});

describe('CoordinatingColours', () => {
  it('starts with a liked colour and shows its matches', () => {
    render(<CoordinatingColours colours={OWN} coordinating={COMBOS.coordinating} />);
    expect(screen.getByRole('radio', { name: 'Teal, #1F7A72, liked' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('heading', { name: 'Goes with Teal' })).toBeInTheDocument();
    expect(screen.getByText('Mustard')).toBeInTheDocument();
  });

  it('switches colour and says when there is no close match', () => {
    render(<CoordinatingColours colours={OWN} coordinating={COMBOS.coordinating} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Rust, #A8432A' }));
    expect(screen.getByRole('heading', { name: 'Goes with Rust' })).toBeInTheDocument();
    expect(screen.getByText('Cream')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Cream, #F2E8CF' }));
    expect(screen.getByText('No close matches in your colours for this one.')).toBeInTheDocument();
  });
});
