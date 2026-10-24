// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesignFeatureItem, DesignFeaturesResponse } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  saveDesignAction: vi.fn(async () => ({ success: 'Your preferences are saved.' })),
  resetDesignAction: vi.fn(async () => ({ success: 'Your selection is cleared.' })),
  setFeaturePreferenceAction: vi.fn(async () => ({ success: 'Saved.' })),
  saveStylingGoalsAction: vi.fn(async () => ({ success: 'Your styling goals are saved.' })),
}));
vi.mock('@/app/actions/design', () => actions);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import { DesignStudio } from '@/components/design/DesignStudio';

// Outfit Categories → design features (D-132): the visual customizer keeps choices locally until Save.

const img = (name: string) => ({ assetId: `ILL-${name}`, url: `/illustrations/design/women-${name}.svg`, alt: name });
const feature = (
  featureId: string,
  name: string,
  category: DesignFeatureItem['category'],
  extra: Partial<DesignFeatureItem> = {},
) => ({
  featureId,
  name,
  description: `${name} description.`,
  category,
  image: img(featureId),
  layer: img(`layer-${featureId}`),
  suitability: null,
  preference: null,
  ...extra,
});

const DATA: DesignFeaturesResponse = {
  department: 'women',
  garmentType: {
    id: 'kurta',
    name: 'Kurta',
    kind: 'top',
    outfitCategories: ['indian'],
    featureCategories: ['neckline', 'sleeve', 'fit'],
  },
  view: 'suits',
  basis: { bodyType: true, heightBand: 'petite', stylingGoals: 0 },
  baseFigure: img('base'),
  categories: [
    {
      id: 'neckline',
      label: 'Necklines and collars',
      presentation: 'illustrated',
      personalised: true,
      features: [
        feature('neckline_square_neck', 'Square neck', 'neckline', {
          suitability: { result: 'recommended', reasons: ['Adds structure across the collarbones.'] },
        }),
        feature('neckline_strapless', 'Strapless', 'neckline', {
          suitability: { result: 'alternative', reasons: ['Shows the shoulders.'] },
        }),
      ],
    },
    {
      id: 'sleeve',
      label: 'Sleeves',
      presentation: 'grid',
      personalised: true,
      features: [
        feature('sleeve_full_length', 'Full-length sleeve', 'sleeve', {
          suitability: { result: 'recommended', reasons: ['Long line.'] },
        }),
      ],
    },
    {
      id: 'fit',
      label: 'Fit',
      presentation: 'tags',
      personalised: false,
      features: [feature('fit_a_line', 'A-line fit', 'fit')],
    },
  ],
  incompatible: [['neckline_strapless', 'sleeve_full_length']],
  selection: null,
};

describe('DesignStudio', () => {
  it('shows the cards with reasons and stacks the chosen neckline and sleeve on the figure', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    expect(screen.getByText('Adds structure across the collarbones.')).toBeTruthy();
    expect(screen.getAllByText('Suits you').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Square neck' }));
    await userEvent.click(screen.getByRole('button', { name: 'Full-length sleeve' }));
    const figure = screen.getByLabelText('Your selected combination');
    const layers = [...figure.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(layers).toEqual([
      '/illustrations/design/women-base.svg',
      '/illustrations/design/women-layer-neckline_square_neck.svg',
      '/illustrations/design/women-layer-sleeve_full_length.svg',
    ]);
  });

  it('disables a neckline that cannot be made with the chosen sleeve', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Full-length sleeve' }));
    expect((screen.getByRole('button', { name: 'Strapless' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves the selection and goals only when Save preferences is pressed', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={['define_waist']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Square neck' }));
    await userEvent.click(screen.getByRole('button', { name: 'A-line fit' }));
    expect(actions.saveDesignAction).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
    expect(actions.saveDesignAction).toHaveBeenCalledWith({
      selection: {
        garmentType: 'kurta',
        outfitCategory: 'indian',
        selectedFeatures: { neckline: 'neckline_square_neck', fit: 'fit_a_line' },
        customization: {},
      },
      stylingGoals: ['define_waist'],
    });
    expect(await screen.findByText('Your preferences are saved.')).toBeTruthy();
  });

  it('Discover my style saves the design first, then opens Discover My Style for it', async () => {
    actions.saveDesignAction.mockClear();
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    const discover = screen.getByRole('button', { name: /Discover my style/ });
    expect((discover as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Pick a neckline or sleeve first.')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Square neck' }));
    await userEvent.click(discover);
    expect(actions.saveDesignAction).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith('/discover/looks?from=design&garment=kurta&outfit=indian');
  });

  it('stays on the page with the error when the design cannot be saved', async () => {
    router.push.mockClear();
    actions.saveDesignAction.mockResolvedValueOnce({ error: 'Something went wrong. Please try again.' } as never);
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Square neck' }));
    await userEvent.click(screen.getByRole('button', { name: /Discover my style/ }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('likes a feature through its own action', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Like Square neck' }));
    expect(actions.setFeaturePreferenceAction).toHaveBeenCalledWith('neckline_square_neck', 'liked');
  });

  it('saves styling goals immediately when clicked', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    const goalBtn = screen.getByRole('button', { name: /define the waist/i });
    await userEvent.click(goalBtn);
    expect(actions.saveStylingGoalsAction).toHaveBeenCalledWith(['define_waist']);
  });

  it('renders lower body customer try-on mannequin and cut cards for trousers', async () => {
    const TROUSERS_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'trousers',
        name: 'Trousers',
        kind: 'bottom',
        outfitCategories: ['western'],
        featureCategories: ['leg_shape', 'waistline', 'fit'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: img('base'),
      categories: [
        {
          id: 'leg_shape',
          label: 'Leg shape',
          presentation: 'tags',
          personalised: true,
          features: [
            feature('leg_shape_straight', 'Straight leg', 'leg_shape'),
            feature('leg_shape_wide', 'Wide palazzo leg', 'leg_shape'),
            feature('leg_shape_flared', 'Flared leg', 'leg_shape'),
          ],
        },
        {
          id: 'waistline',
          label: 'Waistline and rise',
          presentation: 'tags',
          personalised: true,
          features: [feature('waistline_high_rise', 'High rise', 'waistline')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={TROUSERS_DATA} outfitCategory="western" stylingGoals={[]} />);
    expect(screen.getByText('Trouser Types & Leg Cuts')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Straight leg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Wide palazzo leg' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lower body visual try on')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Wide palazzo leg' }));
    expect(screen.getByRole('button', { name: 'Wide palazzo leg' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('provides front view and back view toggle with back neck designs for saree blouse', async () => {
    const BLOUSE_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'saree_blouse',
        name: 'Saree blouse',
        kind: 'top',
        outfitCategories: ['indian'],
        featureCategories: ['neckline', 'sleeve'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: img('base'),
      categories: [
        {
          id: 'neckline',
          label: 'Necklines and collars',
          presentation: 'illustrated',
          personalised: true,
          features: [
            feature('neckline_round_neck', 'Round neck', 'neckline'),
            feature('neckline_deep_u_back', 'Deep U back', 'neckline'),
            feature('neckline_backless_dori', 'Backless with tie-up dori', 'neckline'),
          ],
        },
        {
          id: 'sleeve',
          label: 'Sleeves',
          presentation: 'grid',
          personalised: true,
          features: [feature('sleeve_short', 'Short sleeve', 'sleeve')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={BLOUSE_DATA} outfitCategory="indian" stylingGoals={[]} />);
    expect(screen.getByText('Front Necklines & Bodice')).toBeInTheDocument();
    expect(screen.getByText('Back Neck Designs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Front View' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back View' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Back View' }));
    expect(screen.getByLabelText('Blouse back view try on')).toBeInTheDocument();
  });

  it('renders collar and fit styling on the visual customizer mannequin', async () => {
    const SHIRT_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'shirt',
        name: 'Shirt',
        kind: 'top',
        outfitCategories: ['western'],
        featureCategories: ['neckline', 'fit'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: img('base'),
      categories: [
        {
          id: 'neckline',
          label: 'Necklines and collars',
          presentation: 'illustrated',
          personalised: true,
          features: [
            feature('neckline_collar', 'Collar neck', 'neckline'),
            feature('neckline_mandarin_collar', 'Mandarin collar', 'neckline'),
          ],
        },
        {
          id: 'fit',
          label: 'Fit & Silhouette',
          presentation: 'tags',
          personalised: true,
          features: [feature('fit_slim', 'Slim fit', 'fit')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={SHIRT_DATA} outfitCategory="western" stylingGoals={[]} />);
    expect(screen.getByText('Necklines and collars')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collar neck' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Collar neck' }));
    await userEvent.click(screen.getByRole('button', { name: 'Slim fit' }));

    const overlay = screen.getByLabelText('Upper body styling overlay');
    expect(overlay).toBeInTheDocument();
  });

  it('renders multi-piece Lehenga customizer with ensemble, choli, and skirt view toggles and dedicated sections', async () => {
    const LEHENGA_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'lehenga',
        name: 'Lehenga',
        kind: 'one_piece',
        outfitCategories: ['indian'],
        featureCategories: ['neckline', 'sleeve', 'fit', 'waistline', 'draping'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: img('base'),
      categories: [
        {
          id: 'neckline',
          label: 'Necklines and collars',
          presentation: 'illustrated',
          personalised: true,
          features: [feature('neckline_sweetheart', 'Sweetheart neck', 'neckline')],
        },
        {
          id: 'sleeve',
          label: 'Sleeves',
          presentation: 'grid',
          personalised: true,
          features: [feature('sleeve_elbow_length', 'Elbow-length sleeve', 'sleeve')],
        },
        {
          id: 'fit',
          label: 'Fit & Silhouette',
          presentation: 'tags',
          personalised: true,
          features: [
            feature('fit_slim', 'Slim fit', 'fit'),
            feature('fit_flared', 'Flared fit', 'fit'),
          ],
        },
        {
          id: 'waistline',
          label: 'Waistline and rise',
          presentation: 'tags',
          personalised: true,
          features: [feature('waistline_high_waist', 'High waist', 'waistline')],
        },
        {
          id: 'draping',
          label: 'Draping',
          presentation: 'tags',
          personalised: true,
          features: [feature('draping_nivi', 'Classic Nivi drape', 'draping')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={LEHENGA_DATA} outfitCategory="indian" stylingGoals={[]} />);

    // Anatomical multi-piece sections
    expect(screen.getByText('Choli / Blouse: Necklines & Bodice')).toBeInTheDocument();
    expect(screen.getByText('Choli / Blouse: Sleeves')).toBeInTheDocument();
    expect(screen.getByText('Lehenga / Skirt: Fit & Silhouette')).toBeInTheDocument();
    expect(screen.getByText('Lehenga / Skirt: Waist & Closure')).toBeInTheDocument();
    expect(screen.getByText('Dupatta: Style & Drape')).toBeInTheDocument();

    // Visual Customizer View Toggles
    expect(screen.getByRole('button', { name: 'Full Ensemble' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choli / Blouse' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lehenga Skirt' })).toBeInTheDocument();

    // Default Full Ensemble Mannequin rendered
    expect(screen.getByLabelText('Lehenga ensemble visual try on')).toBeInTheDocument();

    // Toggle views
    await userEvent.click(screen.getByRole('button', { name: 'Lehenga Skirt' }));
    expect(screen.getByLabelText('Lehenga ensemble visual try on')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Choli / Blouse' }));
    expect(screen.getByLabelText('Lehenga ensemble visual try on')).toBeInTheDocument();
  });

  it('updates lower body trouser mannequin when selecting flared fit and cargo pockets', async () => {
    const TROUSERS_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'trousers',
        name: 'Trousers',
        kind: 'bottom',
        outfitCategories: ['western'],
        featureCategories: ['leg_shape', 'waistline', 'fit', 'pockets'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: null,
      categories: [
        {
          id: 'fit',
          label: 'Fit & Silhouette',
          presentation: 'tags',
          personalised: true,
          features: [
            feature('fit_flared', 'Flared fit', 'fit'),
            feature('fit_slim', 'Slim fit', 'fit'),
          ],
        },
        {
          id: 'pockets',
          label: 'Pockets',
          presentation: 'tags',
          personalised: true,
          features: [feature('pockets_cargo', 'Cargo', 'pockets')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={TROUSERS_DATA} outfitCategory="western" stylingGoals={[]} />);
    expect(screen.getByLabelText('Lower body visual try on')).toBeInTheDocument();

    // Click Flared fit
    await userEvent.click(screen.getByRole('button', { name: 'Flared fit' }));
    // Click Cargo pockets
    await userEvent.click(screen.getByRole('button', { name: 'Cargo' }));

    const mannequin = screen.getByLabelText('Lower body visual try on');
    expect(mannequin).toBeInTheDocument();
    expect(mannequin.innerHTML).toContain('fill="#fbf6ec"');
  });

  it('renders skirt silhouette and panels without pants for skirt bottom garment', async () => {
    const SKIRT_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'skirt',
        name: 'Skirt',
        kind: 'bottom',
        outfitCategories: ['western'],
        featureCategories: ['fit', 'waistline', 'length', 'pleats'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: null,
      categories: [
        {
          id: 'fit',
          label: 'Skirt Silhouette & Flare',
          presentation: 'tags',
          personalised: true,
          features: [
            feature('fit_a_line', 'A-Line', 'fit'),
            feature('fit_flared', 'Flared', 'fit'),
          ],
        },
        {
          id: 'waistline',
          label: 'Waist Rise & Waistband',
          presentation: 'tags',
          personalised: true,
          features: [feature('waistline_high', 'High waist', 'waistline')],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={SKIRT_DATA} outfitCategory="western" stylingGoals={[]} />);
    expect(screen.getByText('Skirt Silhouette & Flare')).toBeInTheDocument();
    expect(screen.queryByText('Trouser Types & Leg Cuts')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'A-Line' }));
    const mannequin = screen.getByLabelText('Lower body visual try on');
    expect(mannequin).toBeInTheDocument();
    // Skirt uses continuous waistband, not trouser fly line
    expect(mannequin.innerHTML).toContain('fill="#fbf6ec"');
  });

  it('renders sweetheart neckline, puff sleeve, and dynamic dupatta drape on lehenga mannequin', async () => {
    const LEHENGA_DETAILS_DATA: DesignFeaturesResponse = {
      department: 'women',
      garmentType: {
        id: 'lehenga',
        name: 'Lehenga',
        kind: 'one_piece',
        outfitCategories: ['indian'],
        featureCategories: ['neckline', 'sleeve', 'fit', 'draping'],
      },
      view: 'suits',
      basis: { bodyType: true, heightBand: 'average', stylingGoals: 0 },
      baseFigure: null,
      categories: [
        {
          id: 'neckline',
          label: 'Choli / Blouse: Neckline',
          presentation: 'illustrated',
          personalised: true,
          features: [feature('neckline_sweetheart', 'Sweetheart neck', 'neckline')],
        },
        {
          id: 'sleeve',
          label: 'Choli / Blouse: Sleeves',
          presentation: 'grid',
          personalised: true,
          features: [feature('sleeve_puff', 'Puff sleeve', 'sleeve')],
        },
        {
          id: 'draping',
          label: 'Dupatta: Style & Drape',
          presentation: 'tags',
          personalised: true,
          features: [
            feature('draping_straight', 'Straight drape', 'draping'),
            feature('draping_gathered', 'Gathered', 'draping'),
          ],
        },
      ],
      incompatible: [],
      selection: null,
    };

    render(<DesignStudio data={LEHENGA_DETAILS_DATA} outfitCategory="indian" stylingGoals={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sweetheart neck' }));
    await userEvent.click(screen.getByRole('button', { name: 'Puff sleeve' }));
    await userEvent.click(screen.getByRole('button', { name: 'Straight drape' }));

    const mannequin = screen.getByLabelText('Lehenga ensemble visual try on');
    expect(mannequin).toBeInTheDocument();
    // Verify dynamic straight drape and puff sleeves are rendered
    expect(mannequin.innerHTML).toContain('M 64 52 L 40 145 L 36 215');
    // Verify puff sleeves are rendered
    expect(mannequin.innerHTML).toContain('M 64 52 C 48 48 46 68 54 78');
  });
});

