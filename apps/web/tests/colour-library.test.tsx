// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategoryColourItem, MyColoursResponse } from '@styleme/contracts';

// My colours (D-133): only the user's own skin tone × undertone, and the album-style multi-select of colours.

const mocks = vi.hoisted(() => ({
  setColourPreferenceAction: vi.fn(),
  apiRequest: vi.fn(),
  requireOnboarded: vi.fn().mockResolvedValue({ accessToken: 'test-token' }),
}));
vi.mock('@/app/actions/colours', () => ({ setColourPreferenceAction: mocks.setColourPreferenceAction }));
vi.mock('@/lib/api/server', () => ({ apiRequest: mocks.apiRequest, ApiError: class extends Error {} }));
vi.mock('@/lib/auth/session', () => ({ requireOnboarded: mocks.requireOnboarded }));

import MyColoursPage from '@/app/(app)/palette/colours/page';
import { ColourAlbum } from '@/components/colours/ColourAlbum';

function colour(id: number, family: CategoryColourItem['family'], preference: CategoryColourItem['preference'] = null) {
  return {
    colourId: `CLR-${String(id).padStart(4, '0')}`,
    name: `Colour ${id}`,
    hex: '#AA5533',
    family,
    temperature: 'warm',
    depth: 'medium',
    intensity: 'medium',
    oklch: { l: 0.5, c: 0.1, h: 50 },
    source: 'xkcd',
    preference,
    score: 90 - id,
    rank: id,
    reasons: [`Reason A for ${id}.`, 'Clear contrast against Monk 6 skin.'],
  } satisfies CategoryColourItem;
}

const COLOURS = [colour(1, 'red'), colour(2, 'red'), colour(3, 'blue', 'liked'), colour(4, 'green', 'avoided')];

beforeEach(() => {
  mocks.setColourPreferenceAction.mockReset();
  mocks.apiRequest.mockReset();
});

describe('ColourAlbum', () => {
  it('selects several colours and saves them as liked', async () => {
    mocks.setColourPreferenceAction.mockResolvedValue({ success: '2 colours saved as liked.' });
    render(<ColourAlbum colours={COLOURS} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Colour 1,/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Colour 2,/ }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Like' }));
    });
    expect(mocks.setColourPreferenceAction).toHaveBeenCalledWith(['CLR-0001', 'CLR-0002'], 'liked');
    expect(screen.getByRole('checkbox', { name: 'Colour 1, #AA5533, liked' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByText('2 colours saved as liked.').length).toBeGreaterThan(0);
  });

  it('shows the reasons when one colour is selected', () => {
    render(<ColourAlbum colours={COLOURS} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Colour 2,/ }));
    expect(screen.getByText('Reason A for 2.')).toBeInTheDocument();
    expect(screen.getByText('Match 88/100')).toBeInTheDocument();
  });

  it('filters by family and by the user’s choice', () => {
    render(<ColourAlbum colours={COLOURS} />);
    fireEvent.click(screen.getByRole('button', { name: /Reds/ }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /All colours/ }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Filter by your choice' })).getByRole('button', { name: /Avoided/ }),
    );
    expect(screen.getAllByRole('checkbox').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Colour 4, #AA5533, avoided',
    ]);
  });

  it('keeps an error visible and the selection in place when saving fails', async () => {
    mocks.setColourPreferenceAction.mockResolvedValue({ error: 'Unknown colour' });
    render(<ColourAlbum colours={COLOURS} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Colour 1,/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Avoid' }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown colour');
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('in saved mode, cleared colours leave the list', async () => {
    mocks.setColourPreferenceAction.mockResolvedValue({ success: 'Colour cleared.' });
    render(<ColourAlbum colours={[colour(3, 'blue', 'liked'), colour(4, 'green', 'avoided')]} mode="saved" />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Colour 3,/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear choice' }));
    });
    expect(mocks.setColourPreferenceAction).toHaveBeenCalledWith(['CLR-0003'], 'none');
    expect(screen.queryByRole('checkbox', { name: /Colour 3,/ })).not.toBeInTheDocument();
  });
});

describe('My colours page', () => {
  const MINE: MyColoursResponse = {
    missing: null,
    category: {
      categoryId: 'monk-06-warm',
      monkTone: 6,
      undertone: 'warm',
      label: 'Monk 6 · Warm',
      colourCount: 4,
      preview: [],
      skinHex: '#A07E56',
      rationale: 'A warm undertone has a golden cast.',
      limitations: 'Suggestions are a starting point.',
      reviewStatus: 'approved',
    },
    families: [],
    colours: COLOURS,
    saved: { liked: 3, avoided: 1 },
  };

  it('shows only the user’s own skin tone and undertone', async () => {
    mocks.apiRequest.mockResolvedValue(MINE);
    render(await MyColoursPage());
    expect(mocks.apiRequest).toHaveBeenCalledWith('/v1/colours/mine', { token: 'test-token' });
    expect(screen.getByRole('heading', { level: 1, name: 'Colours for Monk 6 · Warm' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
    expect(screen.queryByText(/Monk 5|Cool|Olive/)).not.toBeInTheDocument();
    expect(screen.queryByText(/draft awaiting founder review/)).not.toBeInTheDocument();
    expect(screen.getByText('(3 liked, 1 avoided)')).toBeInTheDocument();
  });

  it('flags a draft preview', async () => {
    mocks.apiRequest.mockResolvedValue({ ...MINE, category: { ...MINE.category!, reviewStatus: 'draft' } });
    render(await MyColoursPage());
    expect(screen.getByText(/draft awaiting founder review/)).toBeInTheDocument();
  });

  it('asks for the missing skin tone or undertone instead of showing other colours', async () => {
    mocks.apiRequest.mockResolvedValue({ ...MINE, missing: 'undertone', category: null, colours: [] });
    render(await MyColoursPage());
    expect(screen.getByText('Add your undertone to see your colours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to My Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });
});
