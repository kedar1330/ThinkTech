// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  recommendationResponseSchema,
  type Look,
  type ProfileSizes,
  type RecommendationResponse,
} from '@styleme/contracts';

const actions = vi.hoisted(() => ({ requestLooksAction: vi.fn() }));
vi.mock('@/app/actions/discover', () => actions);

import { RequestForm } from '@/components/discover/RequestForm';
import { LookCard } from '@/components/outfits/LookCard';
import { ResultFlags } from '@/components/outfits/ResultFlags';
import { resultNotices, uniqueLooks } from '@/lib/discover/results';

// Synthetic responses, parsed by the contract so they match what the API returns.

const SIZES: ProfileSizes = { tops: null, bottoms: { waistIn: 32 }, ethnicTops: null, ethnicSets: null, shoes: null };

function look(n: number, signature = `sig-${n}`): Look {
  return {
    id: String(n).padStart(24, '0'),
    status: 'suggested',
    templateId: `OUT-00${n}`,
    paletteId: 'PAL-001',
    explanation: `Explanation for look ${n}.`,
    explanationRefs: { ruleIds: ['STY-001'], attributes: [] },
    combinationSignature: signature,
    aiModel: null,
    slots: [
      {
        slotId: 'top',
        slot: 'top',
        lookSpec: { category: 'kurta', colorFamily: 'red', colorId: 'maroon', fabric: 'cotton', fit: 'regular' },
        swatches: [{ colorId: 'maroon', name: 'Maroon', hex: '#800020' }],
        searchPhrase: 'maroon cotton kurta',
        sizeNote: 'Add your size',
        alternatives: [],
      },
      {
        slotId: 'bottom',
        slot: 'bottom',
        lookSpec: { category: 'trousers', colorFamily: 'neutral', colorId: 'ivory', silhouette: 'straight' },
        swatches: [{ colorId: 'ivory', name: 'Ivory', hex: '#F8F4E8' }],
        searchPhrase: 'ivory straight trousers',
        sizeNote: 'Your saved size: 32',
        alternatives: [],
      },
    ],
  };
}

function response(looks: Look[], extra: Partial<RecommendationResponse> = {}): RecommendationResponse {
  return recommendationResponseSchema.parse({
    recommendationId: 'f'.repeat(24),
    looks,
    defaultsApplied: [],
    conflicts: [],
    ...extra,
  });
}

const FIVE = response([1, 2, 3, 4, 5].map((n) => look(n)));
const TWO_LIMITED = response([look(1), look(2)], {
  limitedBy: { constraint: 'wearType', suggestion: 'Choose another wear type, or none to see all three.' },
});

beforeEach(() => actions.requestLooksAction.mockReset());

describe('result flags (FR-LOOK-09 … 11)', () => {
  it('says nothing extra for a full set of 5 looks', () => {
    expect(resultNotices(FIVE)).toEqual([]);
  });

  it('explains limited results with the suggested change (INSUFFICIENT_MATCHES)', () => {
    expect(resultNotices(TWO_LIMITED)).toEqual([
      {
        id: 'insufficient',
        text: 'Only 2 looks matched this request. Choose another wear type, or none to see all three.',
      },
    ]);
  });

  it('shows an empty state when no look matched', () => {
    expect(resultNotices(response([])).map((n) => n.text)).toEqual([
      'No looks matched this request. Try another occasion or fewer filters.',
    ]);
  });

  it('names each default applied and skips unknown names (DEFAULTS_APPLIED)', () => {
    const texts = resultNotices(
      response(FIVE.looks, { defaultsApplied: ['department', 'colors', 'signals', 'sizes', 'style', 'unknown'] }),
    ).map((n) => n.text);
    expect(texts).toEqual([
      'No department filter applied: looks can come from every department.',
      "You haven't picked colours you like, so each look uses its palette's colours.",
      'Appearance signals are not used (none saved, or switched off).',
      'No sizes saved yet, so each item asks you to add one.',
      'No style chosen, so looks can be in any style.',
    ]);
  });

  it('explains liked-and-avoided conflicts by name (PREFERENCE_CONFLICT)', () => {
    const texts = resultNotices(
      response(FIVE.looks, {
        conflicts: [
          { field: 'colors', value: 'maroon' },
          { field: 'fabrics', value: 'linen' },
        ],
      }),
    ).map((n) => n.text);
    expect(texts).toEqual([
      'You both like and avoid maroon, so it is treated as avoided.',
      'You both like and avoid linen, so it is treated as avoided.',
    ]);
  });

  it('renders each notice as a status message', () => {
    render(<ResultFlags result={TWO_LIMITED} />);
    expect(screen.getByRole('status')).toHaveTextContent('Only 2 looks matched this request.');
  });
});

describe('look card', () => {
  it('shows the explanation and, per item, its name, colours, hints, search phrase and size note', () => {
    render(<LookCard look={look(1)} position={1} sizes={SIZES} />);
    const card = screen.getByRole('article', { name: 'Look 1' });
    expect(card).toHaveTextContent('Explanation for look 1.');
    const [kurta, trousers] = [
      ...within(card).getByRole('list', { name: 'Items in this look' }).children,
    ] as HTMLElement[];
    expect(kurta).toHaveTextContent('Kurta');
    expect(kurta).toHaveTextContent('Maroon');
    expect(kurta).toHaveTextContent('Cotton · Regular');
    expect(kurta).toHaveTextContent('Search for: maroon cotton kurta');
    expect(within(kurta!).getByRole('link', { name: 'Add your size' })).toHaveAttribute('href', '/profile#sizes');
    expect(trousers).toHaveTextContent('Straight');
    expect(trousers).toHaveTextContent('Your saved size: Waist 32 in');
  });

  it('never repeats a combination (AC-08)', () => {
    expect(uniqueLooks([look(1, 'same'), look(2, 'same'), look(3)]).map((l) => l.templateId)).toEqual([
      'OUT-001',
      'OUT-003',
    ]);
  });
});

describe('results on the Discover page', () => {
  it('shows up to 5 looks in engine order below the form', async () => {
    actions.requestLooksAction.mockResolvedValue({ result: FIVE });
    const user = userEvent.setup();
    render(<RequestForm sizes={SIZES} />);
    await user.click(screen.getByRole('radio', { name: 'Work' }));
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));

    const results = await screen.findByRole('region', { name: 'Your looks' });
    expect(
      within(results)
        .getAllByRole('article')
        .map((a) => a.getAttribute('aria-labelledby')),
    ).toEqual(FIVE.looks.map((l) => `look-${l.id}`));
    expect(within(results).queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows 2 looks with the limited-results message', async () => {
    actions.requestLooksAction.mockResolvedValue({ result: TWO_LIMITED });
    const user = userEvent.setup();
    render(<RequestForm sizes={SIZES} />);
    await user.click(screen.getByRole('radio', { name: 'Work' }));
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));

    const results = await screen.findByRole('region', { name: 'Your looks' });
    expect(within(results).getAllByRole('article')).toHaveLength(2);
    expect(within(results).getByRole('status')).toHaveTextContent('Only 2 looks matched');
  });

  it('offers Retry after an error, which sends the same request again', async () => {
    actions.requestLooksAction
      .mockResolvedValueOnce({ error: 'We could not reach StyleMe.' })
      .mockResolvedValueOnce({ result: FIVE });
    const user = userEvent.setup();
    render(<RequestForm sizes={SIZES} />);
    await user.click(screen.getByRole('radio', { name: 'Festive' }));
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach StyleMe.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('region', { name: 'Your looks' })).toBeInTheDocument();
    expect(actions.requestLooksAction).toHaveBeenCalledTimes(2);
    expect((actions.requestLooksAction.mock.calls[1]![1] as FormData).get('occasion')).toBe('festive');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('offers no Retry for field errors', async () => {
    actions.requestLooksAction.mockResolvedValue({
      error: 'Please check the highlighted fields.',
      fieldErrors: { occasion: 'Choose an occasion.' },
    });
    const user = userEvent.setup();
    render(<RequestForm sizes={SIZES} />);
    await user.click(screen.getByRole('button', { name: 'Show me looks' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
