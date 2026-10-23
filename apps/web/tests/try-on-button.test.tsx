// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Once Virtual Try-On is built (its feature gets an href), the button opens it with the look and the garment
// (#124). Until then it opens the Coming soon page (covered in shop-tabs and shop-products-figure tests).

vi.mock('@/lib/features', async (actual) => {
  const real = await actual<typeof import('@/lib/features')>();
  const FEATURES = real.FEATURES.map((f) => (f.slug === 'virtual-try-on' ? { ...f, href: '/try-on' } : f));
  return {
    ...real,
    FEATURES,
    findFeature: (slug: string) => FEATURES.find((f) => f.slug === slug),
  };
});

import { TryOnButton } from '@/components/shop/TryOnButton';

const ID = 'd'.repeat(24);

describe('TryOnButton once Virtual Try-On exists', () => {
  it('opens try-on with the look, and with the garment when one is given', () => {
    const { rerender } = render(<TryOnButton outfitId={ID} lookName="Everyday look" />);
    expect(screen.getByRole('link', { name: 'Virtual Try-On: Everyday look' })).toHaveAttribute(
      'href',
      `/try-on?outfitId=${ID}`,
    );
    rerender(<TryOnButton outfitId={ID} lookName="Synthetic kurta" slotId="top" />);
    const link = screen.getByRole('link', { name: 'Virtual Try-On: Synthetic kurta' });
    expect(link).toHaveAttribute('href', `/try-on?outfitId=${ID}&slotId=top`);
    expect(link).not.toHaveTextContent('Soon');
  });
});
