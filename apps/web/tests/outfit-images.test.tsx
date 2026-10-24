// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DesignFeaturesResponse, Look } from '@styleme/contracts';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, unoptimized: _u, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}));
const actions = vi.hoisted(() => ({ requestLooksAction: vi.fn(), regenerateAction: vi.fn() }));
vi.mock('@/app/actions/discover', () => actions);

import { RequestForm } from '@/components/discover/RequestForm';
import { DesignMatchBadge, designMatchText } from '@/components/outfits/DesignMatchBadge';
import { OUTFIT_IMAGE_LABEL, OutfitImage } from '@/components/outfits/OutfitImage';
import { PaletteColours } from '@/components/discover/PaletteColours';
import { designSummary, savedDesigns } from '@/lib/discover/design-summary';

// AI outfit images on looks and the "Based on your design" flow (D-132).

const SIZES = { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null };

describe('OutfitImage', () => {
  it('loads the image through our own route, labelled as AI, with a waiting message', () => {
    render(<OutfitImage outfitId={'a'.repeat(24)} ready={false} />);
    const img = screen.getByRole('img', { name: 'AI-generated picture of this outfit' });
    expect(img.getAttribute('src')).toBe(`/api/outfits/${'a'.repeat(24)}/image`);
    expect(screen.getByRole('status')).toHaveTextContent('Creating your outfit image');
    expect(screen.getByText(OUTFIT_IMAGE_LABEL)).toBeInTheDocument();
    fireEvent.load(img);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('disappears when the image cannot be made', () => {
    render(<OutfitImage outfitId={'b'.repeat(24)} ready />);
    fireEvent.error(screen.getByRole('img', { name: 'AI-generated picture of this outfit' }));
    expect(screen.queryByTestId('outfit-image')).not.toBeInTheDocument();
  });
});

describe('DesignMatchBadge', () => {
  it('says how a look compares with the design', () => {
    expect(designMatchText({ level: 'full', differs: [] })).toBe('Matches your design');
    expect(designMatchText({ level: 'partial', differs: ['neckline', 'sleeve'] })).toBe(
      'Close match: different neckline, sleeves',
    );
    render(<DesignMatchBadge match={{ level: 'none', differs: [] }} />);
    expect(screen.getByText('Different garment')).toBeInTheDocument();
  });
});

const FEATURES = {
  department: 'women',
  garmentType: {
    id: 'kurti',
    name: 'Kurti',
    kind: 'top',
    outfitCategories: ['indian', 'fusion'],
    featureCategories: [],
  },
  view: 'all',
  basis: { bodyType: false, heightBand: null, stylingGoals: 0 },
  baseFigure: { assetId: 'base', url: '/illustrations/design/base.svg', alt: 'Figure' },
  categories: [
    {
      id: 'neckline',
      label: 'Necklines',
      presentation: 'illustrated',
      personalised: false,
      features: [
        {
          featureId: 'neckline_v_neck',
          name: 'V-neck',
          description: '',
          category: 'neckline',
          image: null,
          layer: { assetId: 'v', url: '/illustrations/design/v.svg', alt: 'V-neck' },
          suitability: null,
          preference: null,
        },
      ],
    },
  ],
  incompatible: [],
  selection: {
    garmentType: 'kurti',
    outfitCategory: 'indian',
    department: 'women',
    selectedFeatures: { neckline: 'neckline_v_neck' },
    customization: {},
    savedAt: '2026-10-22T00:00:00.000Z',
  },
} as unknown as DesignFeaturesResponse;

describe('Discover My Style opened from a design', () => {
  it('summarises the saved design, or nothing without one', () => {
    expect(designSummary(FEATURES)).toEqual({
      garmentType: 'kurti',
      garmentName: 'Kurti',
      outfitCategory: 'indian',
      outfitLabel: 'Indian',
      features: ['V-neck'],
      layers: [FEATURES.baseFigure, FEATURES.categories[0]!.features[0]!.layer],
      occasionFeature: null,
    });
    expect(designSummary({ ...FEATURES, selection: null })).toBeNull();
  });

  it('shows the opened design’s card and sends it with its outfit category', () => {
    const { container } = render(
      <RequestForm sizes={SIZES} designs={[designSummary(FEATURES)!]} initialDesign="kurti" />,
    );
    expect(screen.getByRole('heading', { name: 'Kurti · Indian' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit design' })).toHaveAttribute(
      'href',
      '/categories/design/kurti?outfit=indian',
    );
    expect(container.querySelector('input[name="designGarment"]')).toHaveValue('kurti');
    expect(container.querySelector('input[name="wearType"]')).toHaveValue('indian');
  });

  it('asks for a design when there is none', () => {
    const { container } = render(<RequestForm sizes={SIZES} />);
    expect(screen.queryByText('Based on your design')).not.toBeInTheDocument();
    expect(container.querySelector('form')).toBeNull();
  });

  it('lists the saved Outfit Categories designs and builds looks around the one chosen', async () => {
    const user = userEvent.setup();
    const designs = savedDesigns(
      [
        {
          ...SELECTION,
          garmentType: 'shirt',
          outfitCategory: 'western',
          garmentName: 'Shirt',
          features: [NAMED('Mandarin collar')],
        },
        { ...SELECTION, garmentName: 'Kurti', features: [NAMED('V-neck')] },
      ],
      null,
    );
    // The newest design is used first; the others can be chosen instead.
    const { container } = render(<RequestForm sizes={SIZES} designs={designs} />);
    expect(screen.getByRole('heading', { name: 'Shirt · Western' })).toBeInTheDocument();
    expect(container.querySelector('input[name="designGarment"]')).toHaveValue('shirt');
    expect(container.querySelector('input[name="wearType"]')).toHaveValue('western');

    await user.click(screen.getByRole('button', { name: /Kurti · Indian/ }));
    expect(screen.getByRole('heading', { name: 'Kurti · Indian' })).toBeInTheDocument();
    expect(container.querySelector('input[name="designGarment"]')).toHaveValue('kurti');
    expect(container.querySelector('input[name="wearType"]')).toHaveValue('indian');
  });

  it('uses the opened design’s drawings in place of its plain entry', () => {
    const opened = designSummary(FEATURES)!;
    const list = savedDesigns([{ ...SELECTION, garmentName: 'Kurti', features: [NAMED('V-neck')] }], opened);
    expect(list).toEqual([opened]);
  });

  it('deduplicates multiple entries for the same garment type, keeping newest first', () => {
    const list = savedDesigns(
      [
        { ...SELECTION, garmentType: 'kurti', garmentName: 'Kurti (Newest)', features: [NAMED('V-neck')] },
        { ...SELECTION, garmentType: 'kurti', garmentName: 'Kurti (Old)', features: [NAMED('Round neck')] },
        { ...SELECTION, garmentType: 'shirt', garmentName: 'Shirt', features: [NAMED('Mandarin collar')] },
      ],
      null,
    );
    expect(list).toHaveLength(2);
    expect(list[0]?.garmentName).toBe('Kurti (Newest)');
    expect(list[1]?.garmentName).toBe('Shirt');
  });

  it('renders DesignChoices without duplicate key warnings when duplicate designs are provided', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kurti1 = { ...designSummary(FEATURES)!, garmentType: 'kurti', garmentName: 'Kurti' };
    const kurti2 = { ...designSummary(FEATURES)!, garmentType: 'kurti', garmentName: 'Kurti 2' };
    const shirt = { ...designSummary(FEATURES)!, garmentType: 'shirt', garmentName: 'Shirt' };

    render(<RequestForm sizes={SIZES} designs={[shirt, kurti1, kurti2]} initialDesign="shirt" />);
    const buttons = screen.getAllByRole('button', { name: /Kurti/ });
    expect(buttons).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Encountered two children with the same key'));
    errorSpy.mockRestore();
  });
});

const SELECTION = FEATURES.selection!;
const NAMED = (name: string) => ({ category: 'neckline' as const, featureId: `neckline_${name}`, name });

describe('PaletteColours', () => {
  it('explains that harmonious colours are used without forcing palette likes', () => {
    render(<PaletteColours />);
    expect(screen.getByText('All harmonious colours')).toBeInTheDocument();
    expect(screen.getByText(/Colours you like in/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Choose specific colours in Colour Palette/ })).toHaveAttribute(
      'href',
      '/palette/colours?from=discover',
    );
  });

  it('shows custom chosen colours when provided', () => {
    render(<PaletteColours customColors={['Emerald', 'Gold']} customColorHexes={['#046A38', '#FFD700']} />);
    expect(screen.getByRole('list', { name: 'Chosen style colours' })).toHaveTextContent('Emerald');
    expect(screen.getByRole('list', { name: 'Chosen style colours' })).toHaveTextContent('Gold');
    expect(screen.getByRole('link', { name: /Change colours in palette/ })).toBeInTheDocument();
  });
});

// Keeps the Look type in use so the contract change is type-checked here too.
export type { Look };
