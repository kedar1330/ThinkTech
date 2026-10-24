// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppearanceResponse, ColourPreferencesResponse, ProfileResponse } from '@styleme/contracts';

const actions = vi.hoisted(() => ({ requestLooksAction: vi.fn(), regenerateAction: vi.fn() }));
vi.mock('@/app/actions/discover', () => actions);

import { ProfileSummary } from '@/components/discover/ProfileSummary';
import { RequestForm } from '@/components/discover/RequestForm';
import type { DesignSummary } from '@/lib/discover/design-summary';

const EMPTY: ProfileResponse = {
  department: null,
  ageGroup: null,
  heightCm: null,
  sizes: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null },
  fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
  likedColors: [],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
  comfortPreferences: [],
  fabricPreferences: { liked: [], avoided: [] },
  preferredStyles: [],
  preferredOccasions: [],
  budgetPreference: null,
  updatedAt: null,
};

beforeEach(() => actions.requestLooksAction.mockReset());

const design = (
  garmentType: string,
  outfitCategory: DesignSummary['outfitCategory'],
  occasionFeature: string | null,
) => ({
  garmentType,
  garmentName: garmentType === 'kurti' ? 'Kurti' : 'Shirt',
  outfitCategory,
  outfitLabel: outfitCategory === 'indian' ? 'Indian' : 'Western',
  features: ['V-neck'],
  layers: [],
  occasionFeature,
});
const KURTI = design('kurti', 'indian', 'occasion_festive');
const SHIRT = design('shirt', 'western', null);

const sent = (call = 0) => actions.requestLooksAction.mock.calls[call]![1] as FormData;

describe('Discover My Style request (built from Outfit Categories)', () => {
  it('has no occasion, style, wear type or colour fields', () => {
    render(<RequestForm sizes={EMPTY.sizes} designs={[KURTI]} />);
    expect(screen.queryByRole('group', { name: /Occasion/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Style/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('asks for a design in Outfit Categories when there is none', () => {
    render(<RequestForm sizes={EMPTY.sizes} />);
    expect(screen.getByRole('heading', { name: 'Start with a design' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Outfit Categories' })).toHaveAttribute('href', '/categories');
    expect(screen.queryByRole('button', { name: 'Show me looks' })).not.toBeInTheDocument();
  });

  it('sends the design’s occasion tag, outfit category and the suggested colours', async () => {
    actions.requestLooksAction.mockResolvedValue({ success: 'We found 3 looks for this request.' });
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} designs={[KURTI, SHIRT]} />);
    const summary = screen.getByRole('region', { name: 'From Outfit Categories' });
    expect(within(summary).getByText('Festive')).toBeInTheDocument();
    expect(within(summary).getByText('Indian')).toBeInTheDocument();
    expect(within(summary).getByText('All harmonious colours')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(Object.fromEntries(sent())).toEqual({
      designGarment: 'kurti',
      designOutfit: 'indian',
      occasion: 'festive',
      wearType: 'indian',
      paletteMode: 'suggested',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('We found 3 looks');
  });

  it('takes the occasion from the occasion preferences, else Everyday, and says so', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <RequestForm sizes={EMPTY.sizes} designs={[SHIRT]} occasionPreferences={['occasion_office']} />,
    );
    expect(screen.getByText('From your occasion preferences in Outfit Categories.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(sent().get('occasion')).toBe('work');
    unmount();

    render(<RequestForm sizes={EMPTY.sizes} designs={[SHIRT]} />);
    expect(screen.getByText(/No occasion chosen in Outfit Categories/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(sent(1).get('occasion')).toBe('everyday');
    expect(sent(1).get('wearType')).toBe('western');
  });

  it('builds around another saved design when chosen', async () => {
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} designs={[KURTI, SHIRT]} />);
    await user.click(screen.getByRole('button', { name: /Shirt · Western/ }));
    expect(screen.getByRole('heading', { name: 'Shirt · Western' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(sent().get('designGarment')).toBe('shirt');
  });

  it('disables the submit button while the request is sending', async () => {
    let finish: (state: { success: string }) => void = () => {};
    actions.requestLooksAction.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const user = userEvent.setup();
    render(<RequestForm sizes={EMPTY.sizes} designs={[KURTI]} />);
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(await screen.findByRole('button', { name: /Finding looks/ })).toBeDisabled();

    finish({ success: 'Done.' });
    expect(await screen.findByRole('button', { name: 'Show me looks' })).toBeEnabled();
  });
});

describe('profile summary on the request page', () => {
  it('says no department filter is applied when the profile has no department, with an edit link', () => {
    render(<ProfileSummary profile={EMPTY} appearance={null} colours={null} />);
    expect(screen.getByRole('status')).toHaveTextContent('No department filter applied');
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile#basics');
    const colourLinks = screen.getAllByRole('link', { name: 'Not set — add it' });
    expect(colourLinks.at(-1)).toHaveAttribute('href', '/palette/colours');
  });

  it('shows what My Profile and the colour library hold (D-129, D-133)', () => {
    const attr = <T,>(value: T) => ({ value, source: 'manual' as const, userConfirmed: true, confirmedAt: null });
    const colour = (colourId: string, name: string, preference: 'liked' | 'avoided') => ({
      colourId,
      name,
      hex: '#123456',
      family: 'blue',
      temperature: 'cool',
      depth: 'deep',
      intensity: 'muted',
      oklch: { l: 0.3, c: 0.1, h: 250 },
      source: 'xkcd',
      preference,
    });
    render(
      <ProfileSummary
        profile={{ ...EMPTY, department: 'women', heightCm: 162, budgetPreference: 3000 }}
        appearance={
          {
            skinTone: attr({ monkRange: '6-6' }),
            undertone: attr('warm' as const),
            bodyProportions: null,
            bodyType: attr('hourglass' as const),
            useInRecommendations: true,
          } as unknown as AppearanceResponse
        }
        colours={
          {
            liked: [colour('CLR-0001', 'Navy', 'liked')],
            avoided: [colour('CLR-0002', 'Mustard', 'avoided')],
            updatedAt: null,
          } as unknown as ColourPreferencesResponse
        }
      />,
    );
    expect(screen.queryByText(/No department filter applied/)).not.toBeInTheDocument();
    expect(screen.getByText('Women’s Wear')).toBeInTheDocument();
    expect(screen.getByText('162 cm')).toBeInTheDocument();
    expect(screen.getByText('₹3,000')).toBeInTheDocument();
    expect(screen.getByText('Tone 6, Warm')).toBeInTheDocument();
    expect(screen.getByText('Hourglass')).toBeInTheDocument();
    expect(screen.getByText('Navy')).toBeInTheDocument();
    expect(screen.getByText('Mustard')).toBeInTheDocument();
  });
});
