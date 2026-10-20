// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_GROUPS, type ProfileSizes } from '@styleme/contracts';
import { SizeNote } from '@/components/outfits/SizeNote';
import { sizeNoteFor } from '@/lib/discover/size-note';

const NO_SIZES: ProfileSizes = { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null };
const ALL_SIZES: ProfileSizes = {
  tops: { letter: 'M', collarIn: 15.5 },
  bottoms: { waistIn: 32, lengthIn: 30 },
  ethnicTops: { letter: 'L' },
  ethnicSets: { waistIn: 28 },
  shoes: { uk: 7 },
};
const SIZED = ['t_shirt', 'shirt', 'jeans', 'trousers', 'kurta', 'kurti', 'lehenga', 'shoes'] as const;

describe('sizeNoteFor (FR-SIZE-04)', () => {
  it('shows the saved size for every sized category group', () => {
    expect(sizeNoteFor('shirt', ALL_SIZES)).toEqual({ kind: 'size', value: 'M, collar 15.5 in' });
    expect(sizeNoteFor('t_shirt', { ...ALL_SIZES, tops: { letter: 'S' } })).toEqual({ kind: 'size', value: 'S' });
    expect(sizeNoteFor('jeans', ALL_SIZES)).toEqual({ kind: 'size', value: 'Waist 32 in, length 30 in' });
    expect(sizeNoteFor('trousers', { ...ALL_SIZES, bottoms: { waistIn: 34 } })).toEqual({
      kind: 'size',
      value: 'Waist 34 in',
    });
    expect(sizeNoteFor('kurta', ALL_SIZES)).toEqual({ kind: 'size', value: 'L' });
    expect(sizeNoteFor('kurti', { ...ALL_SIZES, ethnicTops: { numeric: 38 } })).toEqual({
      kind: 'size',
      value: '38 in',
    });
    expect(sizeNoteFor('lehenga', ALL_SIZES)).toEqual({ kind: 'size', value: 'Waist 28 in' });
    expect(sizeNoteFor('lehenga', { ...ALL_SIZES, ethnicSets: { letter: 'M' } })).toEqual({
      kind: 'size',
      value: 'M',
    });
    expect(sizeNoteFor('shoes', ALL_SIZES)).toEqual({ kind: 'size', value: 'UK 7' });
  });

  it('asks for a size when a sized group has none saved', () => {
    for (const category of SIZED) expect(sizeNoteFor(category, NO_SIZES)).toEqual({ kind: 'missing' });
  });

  it('shows nothing for free-size items, whatever is saved', () => {
    for (const category of ['saree', 'accessory'] as const) {
      expect(sizeNoteFor(category, NO_SIZES)).toEqual({ kind: 'none' });
      expect(sizeNoteFor(category, ALL_SIZES)).toEqual({ kind: 'none' });
    }
  });

  it('shows nothing for dresses until the profile has a dress size (Stage 2)', () => {
    expect(sizeNoteFor('dress', ALL_SIZES)).toEqual({ kind: 'none' });
  });

  it('covers every category and category group in the vocabulary', () => {
    const tested = [...SIZED, 'saree', 'accessory', 'dress'];
    expect(CATEGORIES.map((c) => c.id).filter((id) => !tested.includes(id))).toEqual([]);
    const groups = new Set(CATEGORIES.map((c) => c.group));
    expect(CATEGORY_GROUPS.map((g) => g.id).filter((id) => !groups.has(id))).toEqual([]);
  });
});

describe('SizeNote component', () => {
  it('shows the saved size', () => {
    render(<SizeNote category="shoes" sizes={ALL_SIZES} />);
    expect(screen.getByText(/Your saved size:/)).toHaveTextContent('Your saved size: UK 7');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('prompts to add a missing size, linking to the Sizes section of the profile', () => {
    render(<SizeNote category="kurta" sizes={NO_SIZES} />);
    expect(screen.getByText(/No saved size for this item/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your size' })).toHaveAttribute('href', '/profile#sizes');
  });

  it('renders nothing for a free-size item', () => {
    const { container } = render(<SizeNote category="saree" sizes={ALL_SIZES} />);
    expect(container).toBeEmptyDOMElement();
  });
});
