// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Swatch } from '@styleme/contracts';

// Mock next/image to render a plain <img> in jsdom.
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // next/image uses `fill` as a boolean prop; drop it for the plain <img>.
    const { fill: _fill, ...rest } = props;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...rest} />;
  },
}));

import { SlotVisual } from '@/components/outfits/SlotVisual';

// --- Test data -----------------------------------------------------------------------------------------

const SWATCHES: Swatch[] = [
  { colorId: 'maroon', name: 'Maroon', hex: '#800020' },
  { colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' },
];

const CLEARED_ILLUSTRATION = {
  url: '/illustrations/ILL-001.webp',
  licenceLabel: 'CC0 1.0 — team-made',
};

// --- Tests ---------------------------------------------------------------------------------------------

describe('SlotVisual (issue #50)', () => {
  describe('swatch fallback (no illustration)', () => {
    it('renders labelled swatches when no illustration is provided', () => {
      render(<SlotVisual swatches={SWATCHES} />);

      const container = screen.getByTestId('slot-visual-swatches');
      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-illustration')).not.toBeInTheDocument();

      // Every swatch name is in the DOM.
      expect(screen.getByText('Maroon')).toBeInTheDocument();
      expect(screen.getByText('Ivory')).toBeInTheDocument();

      // The colours list is accessible.
      expect(screen.getByRole('list', { name: 'Colours' })).toBeInTheDocument();
    });

    it('renders labelled swatches when illustration is null', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={null} />);

      expect(screen.getByTestId('slot-visual-swatches')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-illustration')).not.toBeInTheDocument();
    });

    it('renders labelled swatches when illustration has no url', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={{ url: '', licenceLabel: 'CC0' }} />);

      expect(screen.getByTestId('slot-visual-swatches')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-illustration')).not.toBeInTheDocument();
    });

    it('renders labelled swatches when illustration has no licenceLabel', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={{ url: '/img.webp', licenceLabel: '' }} />);

      expect(screen.getByTestId('slot-visual-swatches')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-illustration')).not.toBeInTheDocument();
    });

    it('each swatch shows a colour chip and its name in text', () => {
      render(<SlotVisual swatches={SWATCHES} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);

      // Check that the colour chip is decorative (aria-hidden).
      const chips = document.querySelectorAll('[aria-hidden]');
      expect(chips.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('illustration state (cleared asset exists)', () => {
    it('renders the illustration with the mandatory label', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={CLEARED_ILLUSTRATION} />);

      const container = screen.getByTestId('slot-visual-illustration');
      expect(container).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-swatches')).not.toBeInTheDocument();

      // The mandatory label text.
      expect(screen.getByText('Style illustration — not a product')).toBeInTheDocument();
    });

    it('shows the image with the correct alt text', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={CLEARED_ILLUSTRATION} />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'Style illustration — not a product');
      expect(img).toHaveAttribute('src', CLEARED_ILLUSTRATION.url);
    });

    it('shows the licence label', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={CLEARED_ILLUSTRATION} />);

      expect(screen.getByText(/CC0 1\.0 — team-made/)).toBeInTheDocument();
    });

    it('the licence label has a title tooltip', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={CLEARED_ILLUSTRATION} />);

      const licenceEl = screen.getByTitle('CC0 1.0 — team-made');
      expect(licenceEl).toBeInTheDocument();
    });
  });

  describe('no licence → no image', () => {
    it('falls back to swatches when the illustration exists but has an empty licence', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={{ url: '/img.webp', licenceLabel: '' }} />);

      expect(screen.getByTestId('slot-visual-swatches')).toBeInTheDocument();
      expect(screen.queryByTestId('slot-visual-illustration')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('falls back to swatches when the illustration exists but has an empty url', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={{ url: '', licenceLabel: 'CC0' }} />);

      expect(screen.getByTestId('slot-visual-swatches')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('className pass-through', () => {
    it('applies extra classes to the swatch fallback root', () => {
      render(<SlotVisual swatches={SWATCHES} className="mt-4" />);

      const container = screen.getByTestId('slot-visual-swatches');
      expect(container.className).toContain('mt-4');
    });

    it('applies extra classes to the illustration root', () => {
      render(<SlotVisual swatches={SWATCHES} illustration={CLEARED_ILLUSTRATION} className="mt-4" />);

      const container = screen.getByTestId('slot-visual-illustration');
      expect(container.className).toContain('mt-4');
    });
  });
});
