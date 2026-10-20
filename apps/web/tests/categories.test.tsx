// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CatalogueCategoryItem, ClothingStyleItem } from '@styleme/contracts';
import { StyleCard } from '@/components/categories/StyleCard';
import { CategoryExplorer } from '@/components/categories/CategoryExplorer';

const MOCK_CATEGORIES: CatalogueCategoryItem[] = [
  {
    key: 'women-kurtis',
    name: 'Kurtis & Kurtas',
    description: 'Everyday to festive kurtis',
    level: 'category',
    department: 'women',
  },
  {
    key: 'women-tops',
    name: 'Tops & Shirts',
    description: 'Blouses and work tops',
    level: 'category',
    department: 'women',
  },
  {
    key: 'men-shirts',
    name: 'Shirts & Polos',
    description: 'Tailored shirts',
    level: 'category',
    department: 'men',
  },
];

const MOCK_STYLES: ClothingStyleItem[] = [
  {
    styleId: 'CST-101',
    slug: 'a-line-v-neck-kurti',
    name: 'A-Line Kurti with V-Neck',
    description: 'A flowing A-line silhouette with a slender V-neckline',
    department: 'women',
    categoryKey: 'women-kurtis',
    definingAttribute: { attributeId: 'neckline', valueId: 'v_neck' },
    attributes: [
      { attributeId: 'silhouette', valueId: 'a_line' },
      { attributeId: 'fabric', valueId: 'cotton' },
    ],
    wearTypes: ['indian'],
    stylingGoals: ['balanced_silhouette', 'taller_silhouette'],
    bodyShapes: ['pear', 'hourglass'],
    explanation: {
      summary: 'Draws focus upward while the gentle flare balances hips.',
      benefits: ['Elongating vertical effect', 'Comfortable drape'],
      tradeOffs: [],
      stylingTips: ['Pair with straight-leg cotton pants'],
    },
  },
  {
    styleId: 'CST-201',
    slug: 'classic-oxford-shirt',
    name: 'Classic Oxford Shirt',
    description: 'Structured button-down tailored shirt',
    department: 'men',
    categoryKey: 'men-shirts',
    definingAttribute: { attributeId: 'collar', valueId: 'button_down' },
    attributes: [{ attributeId: 'fabric', valueId: 'cotton' }],
    wearTypes: ['western'],
    stylingGoals: ['balanced_silhouette'],
    bodyShapes: ['rectangle', 'triangle'],
    explanation: {
      summary: 'Structured shoulder line frames the torso cleanly.',
      benefits: ['Crisp silhouette'],
      tradeOffs: [],
      stylingTips: ['Pair with tapered chinos'],
    },
  },
];

describe('StyleCard component', () => {
  it('renders style name, attributes, and suitability explanation', () => {
    render(<StyleCard style={MOCK_STYLES[0]!} />);

    expect(screen.getByRole('heading', { name: 'A-Line Kurti with V-Neck' })).toBeInTheDocument();
    expect(screen.getByText(/neckline: v neck/i)).toBeInTheDocument();
    expect(screen.getByText('cotton')).toBeInTheDocument();
    expect(screen.getByText(/Draws focus upward while the gentle flare balances hips/i)).toBeInTheDocument();
    expect(screen.getByText(/Elongating vertical effect/i)).toBeInTheDocument();
    expect(screen.getByText(/pear/i)).toBeInTheDocument();
  });
});

describe('CategoryExplorer component', () => {
  it('renders styles and supports filtering by department and category', async () => {
    const user = userEvent.setup();
    render(<CategoryExplorer initialCategories={MOCK_CATEGORIES} initialStyles={MOCK_STYLES} userDepartment="all" />);

    // Both styles are initially shown
    expect(screen.getByText('A-Line Kurti with V-Neck')).toBeInTheDocument();
    expect(screen.getByText('Classic Oxford Shirt')).toBeInTheDocument();

    // Switch department to Women
    const womenBtn = screen.getByRole('button', { name: 'women' });
    await user.click(womenBtn);

    expect(screen.getByText('A-Line Kurti with V-Neck')).toBeInTheDocument();
    expect(screen.queryByText('Classic Oxford Shirt')).not.toBeInTheDocument();

    // Switch department to Men
    const menBtn = screen.getByRole('button', { name: 'men' });
    await user.click(menBtn);

    expect(screen.queryByText('A-Line Kurti with V-Neck')).not.toBeInTheDocument();
    expect(screen.getByText('Classic Oxford Shirt')).toBeInTheDocument();
  });

  it('filters styles by search query', async () => {
    const user = userEvent.setup();
    render(<CategoryExplorer initialCategories={MOCK_CATEGORIES} initialStyles={MOCK_STYLES} userDepartment="all" />);

    const searchInput = screen.getByRole('searchbox', { name: /Search clothing styles/i });
    await user.type(searchInput, 'Oxford');

    expect(screen.getByText('Classic Oxford Shirt')).toBeInTheDocument();
    expect(screen.queryByText('A-Line Kurti with V-Neck')).not.toBeInTheDocument();
  });
});
