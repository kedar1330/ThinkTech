// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TryOnJob, TryOnOverview } from '@styleme/contracts';

const actions = vi.hoisted(() => ({ startTryOnAction: vi.fn(), deleteTryOnAction: vi.fn() }));
vi.mock('@/app/actions/try-on', () => actions);
// The real viewer needs WebGL; the tests only check how the element is mounted and removed.
vi.mock('@google/model-viewer', () => ({}));

import { ModelViewer } from '@/components/try-on/ModelViewer';
import { TryOnStudio } from '@/components/try-on/TryOnStudio';

// 3D Virtual Try-On page (D-137): the notice comes first, the try-on is polled while it runs, and the
// result shows the picture and the 360° view. All content is synthetic.

const OUTFIT = 'e'.repeat(24);
const JOB = 'f'.repeat(24);
const READY: TryOnOverview = { available: true, drapeAvailable: false, tryOnModel: 'custom_photo', hasPhoto: true };
const ITEM = { store: 'amazon' as const, title: 'Synthetic kurta A', price: 699 };

const job = (overrides: Partial<TryOnJob> = {}): TryOnJob => ({
  id: JOB,
  outfitId: OUTFIT,
  slotId: 'top',
  stage: 'try_on',
  step: 1,
  totalSteps: 1,
  garments: [
    {
      slotId: 'top',
      ...ITEM,
      link: 'https://www.google.com/search?ibp=oshop&q=synthetic',
      imageUrl: 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:synthetic',
    },
  ],
  imageReady: false,
  model3d: 'pending',
  message: null,
  createdAt: '2026-10-23T10:00:00.000Z',
  expiresAt: '2026-10-24T10:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const studio = (overview: TryOnOverview = READY) =>
  render(<TryOnStudio overview={overview} outfitId={OUTFIT} slotId="top" item={ITEM} subject={ITEM.title} />);

describe('TryOnStudio (D-137)', () => {
  it('asks for a photo first, and explains that the dummy model has no try-on yet', () => {
    const { unmount } = studio({ available: true, drapeAvailable: false, tryOnModel: 'dummy_model', hasPhoto: false });
    expect(screen.getByRole('link', { name: /3D Virtual Try-On in My Profile/ })).toHaveAttribute(
      'href',
      '/profile#try-on',
    );
    expect(screen.queryByRole('button', { name: 'Try it on' })).toBeNull();
    unmount();
    studio({ available: true, drapeAvailable: false, tryOnModel: 'dummy_model', hasPhoto: true });
    expect(screen.getByText(/realistic AI picture dresses your own photo/)).toBeInTheDocument();
  });

  it('says so when try-on is not available', () => {
    studio({ ...READY, available: false });
    expect(screen.getByRole('status')).toHaveTextContent('Virtual Try-On is not available right now');
  });

  it('starts only after the user agrees to the notice, with the item they picked', async () => {
    actions.startTryOnAction.mockResolvedValue({ job: job({ stage: 'done', imageReady: true, model3d: 'ready' }) });
    studio();
    expect(screen.getByText(/sends your 3D Virtual Try-On photo/)).toHaveTextContent('fal.ai');
    const tryOn = screen.getByRole('button', { name: 'Try it on' });
    expect(tryOn).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree to send my try-on photo/ }));
    await userEvent.click(tryOn);
    expect(actions.startTryOnAction).toHaveBeenCalledWith({
      outfitId: OUTFIT,
      slotId: 'top',
      item: ITEM,
      agreed: true,
    });
    expect(await screen.findByRole('img', { name: 'Your photo wearing Synthetic kurta A' })).toHaveAttribute(
      'src',
      `/api/try-on/${JOB}/image`,
    );
  });

  it('polls while the try-on runs, then shows the picture and the 360° view', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    actions.startTryOnAction.mockResolvedValue({ job: job() });
    const replies = [
      job({ stage: 'model_3d', imageReady: true }),
      job({ stage: 'done', imageReady: true, model3d: 'ready' }),
    ];
    const fetchMock = vi.fn(async () => Response.json(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    studio();
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await user.click(screen.getByRole('button', { name: 'Try it on' }));
    expect(await screen.findByText(/Dressing your photo/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(await screen.findByRole('img', { name: /Your photo wearing/ })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /360° 3D view/ }));
    expect(screen.getByText(/Building your 360° model/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    const viewer = await vi.waitFor(() => {
      const el = document.querySelector('model-viewer');
      if (!el) throw new Error('no viewer yet');
      return el;
    });
    expect(viewer).toHaveAttribute('src', `/api/try-on/${JOB}/model`);
    expect(viewer).toHaveAttribute('camera-controls');
    expect(viewer).toHaveAttribute('touch-action', 'pan-y');
    expect(fetchMock).toHaveBeenCalledWith(`/api/try-on/${JOB}`, { cache: 'no-store' });

    // Done: no more polls.
    const calls = fetchMock.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('shows the store’s picture and the reason when the try-on fails', async () => {
    actions.startTryOnAction.mockResolvedValue({
      job: job({ stage: 'failed', message: 'We couldn’t finish your try-on just now.' }),
    });
    studio();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Try it on' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t finish your try-on just now.');
    expect(screen.getByRole('link', { name: 'View on Google Shopping' })).toHaveAttribute(
      'rel',
      'noopener noreferrer nofollow',
    );
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('shows the API’s message when the try-on can’t start', async () => {
    actions.startTryOnAction.mockResolvedValue({ error: 'That item is no longer in the search results.' });
    studio();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Try it on' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That item is no longer in the search results.');
  });
});

describe('ModelViewer (D-137)', () => {
  it('mounts the model, shows it once loaded and removes it on unmount', () => {
    const { unmount } = render(<ModelViewer src="/api/try-on/x/model" alt="3D model" />);
    const el = document.querySelector('model-viewer')!;
    expect(el).toHaveAttribute('auto-rotate');
    expect(screen.getByRole('status')).toHaveTextContent('Loading the 3D model');
    act(() => {
      el.dispatchEvent(new Event('load'));
    });
    expect(screen.queryByRole('status')).toBeNull();
    unmount();
    expect(document.querySelector('model-viewer')).toBeNull();
  });

  it('falls back to a message when the model can’t be shown', () => {
    render(<ModelViewer src="/api/try-on/x/model" alt="3D model" />);
    act(() => {
      document.querySelector('model-viewer')!.dispatchEvent(new Event('error'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('3D view couldn’t be shown');
  });
});
