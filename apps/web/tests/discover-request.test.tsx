// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileResponse } from '@styleme/contracts';

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
    expect(within(summary).getByText('From My Colour Palette')).toBeInTheDocument();

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
    render(<ProfileSummary profile={EMPTY} />);
    expect(screen.getByRole('status')).toHaveTextContent('No department filter applied');
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile#basics');
  });

  it('shows the department, sizes, colours and coverage that will be applied', () => {
    render(
      <ProfileSummary
        profile={{
          ...EMPTY,
          department: 'women',
          sizes: { ...EMPTY.sizes, tops: { letter: 'M' }, shoes: { uk: 5 } },
          likedColors: ['ivory'],
          dislikedColors: ['beige'],
          coveragePreferences: { minSleeveLength: 'short', minNecklineCoverage: null, minGarmentLength: null },
        }}
      />,
    );
    expect(screen.queryByText(/No department filter applied/)).not.toBeInTheDocument();
    expect(screen.getByText('Women')).toBeInTheDocument();
    expect(screen.getByText('Tops M · Shoes UK 5')).toBeInTheDocument();
    expect(screen.getByText('Ivory')).toBeInTheDocument();
    expect(screen.getByText('Beige')).toBeInTheDocument();
    expect(screen.getByText('Sleeves at least short sleeve')).toBeInTheDocument();
  });
});
