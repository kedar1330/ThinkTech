// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Look, ProfileSizes, RecommendationResponse } from '@styleme/contracts';

const actions = vi.hoisted(() => ({ requestLooksAction: vi.fn(), regenerateAction: vi.fn() }));
vi.mock('@/app/actions/discover', () => actions);

import { RegenerateButton } from '@/components/outfits/RegenerateButton';
import { WhatChanged } from '@/components/outfits/WhatChanged';

// Regenerate (#49) in the browser: the button, the new looks and "What changed".

const SIZES: ProfileSizes = { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null };

const look = (n: number): Look => ({
  id: String(n).padStart(24, '0'),
  status: 'suggested',
  templateId: `OUT-00${n}`,
  paletteId: 'PAL-001',
  explanation: `New explanation ${n}.`,
  explanationRefs: { ruleIds: [], attributes: [] },
  combinationSignature: `sig-${n}`,
  aiModel: null,
  slots: [
    {
      slotId: 'top',
      slot: 'top',
      lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy' },
      swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
      searchPhrase: 'navy kurta',
      sizeNote: 'Add your size',
      alternatives: [],
    },
  ],
});
const result = (looks: Look[]) =>
  ({ recommendationId: 'f'.repeat(24), looks, defaultsApplied: [], conflicts: [] }) as RecommendationResponse;

beforeEach(() => actions.regenerateAction.mockReset());

describe('RegenerateButton', () => {
  it('sends the look ID, then replaces the current looks with the new ones and what changed', async () => {
    actions.regenerateAction.mockResolvedValue({
      result: result([look(7), look(8)]),
      changes: ['Your avoided colours now include maroon.'],
    });
    const user = userEvent.setup();
    render(
      <RegenerateButton outfitId={'a'.repeat(24)} sizes={SIZES}>
        <p>Original looks</p>
      </RegenerateButton>,
    );
    expect(screen.getByText('Original looks')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Regenerate with my current profile' }));

    expect((actions.regenerateAction.mock.calls[0]![1] as FormData).get('outfitId')).toBe('a'.repeat(24));
    const region = await screen.findByRole('region', { name: 'Regenerated looks' });
    expect(within(region).getByText('What changed')).toBeInTheDocument();
    expect(within(region).getByText('Your avoided colours now include maroon.')).toBeInTheDocument();
    expect(within(region).getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText('Original looks')).not.toBeInTheDocument();
  });

  it('regenerates again from the newest looks', async () => {
    actions.regenerateAction.mockResolvedValue({ result: result([look(7)]), changes: [] });
    const user = userEvent.setup();
    render(<RegenerateButton outfitId={'a'.repeat(24)} sizes={SIZES} />);
    const button = screen.getByRole('button', { name: 'Regenerate with my current profile' });
    await user.click(button);
    await screen.findByRole('region', { name: 'Regenerated looks' });
    await user.click(button);
    expect((actions.regenerateAction.mock.calls[1]![1] as FormData).get('outfitId')).toBe(look(7).id);
  });

  it('shows an error and keeps the current looks', async () => {
    actions.regenerateAction.mockResolvedValue({ error: 'This look is no longer available.' });
    const user = userEvent.setup();
    render(
      <RegenerateButton outfitId={'a'.repeat(24)} sizes={SIZES}>
        <p>Original looks</p>
      </RegenerateButton>,
    );
    await user.click(screen.getByRole('button', { name: 'Regenerate with my current profile' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This look is no longer available.');
    expect(screen.getByText('Original looks')).toBeInTheDocument();
  });
});

describe('WhatChanged', () => {
  it('lists each change, or says nothing changed', () => {
    const { rerender } = render(<WhatChanged changes={['Your department changed from Women to Men.']} />);
    expect(screen.getByRole('listitem')).toHaveTextContent('Your department changed from Women to Men.');
    rerender(<WhatChanged changes={[]} />);
    expect(screen.getByText(/Nothing in your profile has changed/)).toBeInTheDocument();
  });
});
