// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, LookSlot } from '@styleme/contracts';
import { LookTabs } from '@/components/shop/LookTabs';
import { lookTitle } from '@/lib/outfits/look-text';

// Shop My Look tabs (#115): one small tab per saved Discover My Style look, each with Virtual Try-On.

const slot: LookSlot = {
  slotId: 'top',
  slot: 'top',
  lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy' },
  swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
  searchPhrase: 'navy kurta',
  sizeNote: 'Add your size',
  alternatives: [],
};

const look = (n: number): Look => ({
  id: String(n).padStart(24, 'a'),
  status: 'saved',
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: [slot],
  explanation: 'Synthetic.',
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: `sig-${n}`,
  aiModel: null,
  source: 'discover_my_style',
});

// Each tab asks for its price range (#118); these tests are about the tabs themselves.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'PROVIDER_NOT_CONFIGURED' }, { status: 503 })),
  );
});

const tabs = () => screen.getByRole('navigation', { name: 'Your looks from Discover My Style' });

describe('Shop My Look tabs', () => {
  it('shows every look as a tab, with no count and no cap, linking to its shop view', () => {
    const looks = Array.from({ length: 60 }, (_, i) => look(i + 1));
    render(<LookTabs looks={looks} selectedId={looks[0]!.id} />);
    const items = within(tabs()).getAllByRole('listitem');
    expect(items).toHaveLength(60);
    expect(tabs()).not.toHaveTextContent(/\(\d+\)/);

    const first = within(items[0]!).getByRole('link', { name: lookTitle(looks[0]!) });
    expect(first).toHaveAttribute('href', `/shop?outfitId=${looks[0]!.id}`);
  });

  it('marks only the selected tab as current', () => {
    const looks = [look(1), look(2), look(3)];
    render(<LookTabs looks={looks} selectedId={looks[1]!.id} />);
    const current = within(tabs())
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', `/shop?outfitId=${looks[1]!.id}`);
  });

  it('gives each tab a Virtual Try-On button that tries the whole look on (D-137)', () => {
    const looks = [look(1), look(2)];
    render(<LookTabs looks={looks} />);
    for (const [i, item] of within(tabs()).getAllByRole('listitem').entries()) {
      const tryOn = within(item).getByRole('link', { name: `Virtual Try-On: ${lookTitle(looks[i]!)}` });
      expect(tryOn).toHaveAttribute('href', `/try-on?outfitId=${looks[i]!.id}`);
      expect(tryOn).not.toHaveTextContent('Soon');
    }
  });
});
