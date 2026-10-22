// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesignFeatureItem, DesignFeaturesResponse } from '@styleme/contracts';

const actions = vi.hoisted(() => ({
  saveDesignAction: vi.fn(async () => ({ success: 'Your preferences are saved.' })),
  resetDesignAction: vi.fn(async () => ({ success: 'Your selection is cleared.' })),
  setFeaturePreferenceAction: vi.fn(async () => ({ success: 'Saved.' })),
}));
vi.mock('@/app/actions/design', () => actions);

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

  it('likes a feature through its own action', async () => {
    render(<DesignStudio data={DATA} outfitCategory="indian" stylingGoals={[]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Like Square neck' }));
    expect(actions.setFeaturePreferenceAction).toHaveBeenCalledWith('neckline_square_neck', 'liked');
  });
});
