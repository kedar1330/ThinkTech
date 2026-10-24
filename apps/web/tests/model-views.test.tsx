// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  drapeAction: vi.fn(),
  drapeViewAction: vi.fn(),
  startTryOnAction: vi.fn(),
  deleteTryOnAction: vi.fn(),
}));
vi.mock('@/app/actions/try-on', () => actions);

import { ModelViews } from '@/components/try-on/ModelViews';

// The try-on model viewer (D-139): the dressed front first, then the three-quarter, side and back views drawn
// from it, chosen from a strip like a studio turntable.

const OUTFIT = 'c'.repeat(24);
const DRAPE = 'd'.repeat(24);
const KURTA = { slotId: 'top', store: 'amazon' as const, title: 'Kurta A', price: 699 };
const TROUSERS = { slotId: 'bottom', store: 'flipkart' as const, title: 'Trousers F', price: 499 };

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

const views = () => screen.getByRole('tablist', { name: 'Views' });
const main = () => screen.getByRole('img', { name: /Model wearing|Try-on model/ });

describe('ModelViews (D-139)', () => {
  it('shows the undressed model with four views to choose from', () => {
    render(<ModelViews outfitId={OUTFIT} department="men" items={[]} />);
    expect(main()).toHaveAttribute('src', '/api/try-on/avatars/men');
    expect(
      within(views())
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Front', 'Three-quarter', 'Side', 'Back']);
    expect(actions.drapeAction).not.toHaveBeenCalled();
  });

  it('dresses the model, then draws the other angles from the dressed front', async () => {
    vi.useFakeTimers();
    actions.drapeAction.mockResolvedValue({ drape: { id: DRAPE } });
    let finishSide!: (v: { ok: true }) => void;
    actions.drapeViewAction.mockImplementation((_id: string, view: string) =>
      view === 'side' ? new Promise((resolve) => (finishSide = resolve)) : Promise.resolve({ ok: true }),
    );
    render(<ModelViews outfitId={OUTFIT} department="women" items={[TROUSERS, KURTA]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Dressing the model in 2 pieces');
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(actions.drapeAction).toHaveBeenCalledWith({
      outfitId: OUTFIT,
      department: 'women',
      items: [TROUSERS, KURTA],
    });
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=front`);
    expect(main()).toHaveAccessibleName('Model wearing Trousers F, Kurta A, front view');
    expect(actions.drapeViewAction.mock.calls.map((c) => c[1])).toEqual(['three_quarter', 'side', 'back']);

    // The side view is still being drawn: choosing it keeps the front, with a note.
    fireEvent.click(within(views()).getByRole('tab', { name: /Side view/ }));
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=front`);
    expect(screen.getByRole('status')).toHaveTextContent('Drawing the side view');
    await act(async () => finishSide({ ok: true }));
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=side`);

    // The arrows (and ↑ ↓) step through the views.
    fireEvent.click(screen.getByRole('button', { name: 'Next view' }));
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=back`);
    fireEvent.keyDown(views(), { key: 'ArrowDown' });
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=front`);
    fireEvent.keyDown(views(), { key: 'ArrowUp' });
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=back`);
  });

  it('says so when a view couldn’t be drawn, and keeps the front', async () => {
    vi.useFakeTimers();
    actions.drapeAction.mockResolvedValue({ drape: { id: DRAPE } });
    actions.drapeViewAction.mockResolvedValue({ error: 'We couldn’t draw this view just now.' });
    render(<ModelViews outfitId={OUTFIT} department="women" items={[KURTA]} />);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click(within(views()).getByRole('tab', { name: /Back view/ }));
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=front`);
    expect(screen.getByRole('status')).toHaveTextContent('The back view couldn’t be drawn. Showing the front.');
  });

  it('waits for quick changes to settle, and can try again after a failure', async () => {
    vi.useFakeTimers();
    actions.drapeAction.mockResolvedValueOnce({ error: 'We couldn’t dress the model just now.' });
    const { rerender } = render(<ModelViews outfitId={OUTFIT} department="women" items={[KURTA]} />);
    await act(() => vi.advanceTimersByTimeAsync(200));
    rerender(<ModelViews outfitId={OUTFIT} department="women" items={[KURTA, TROUSERS]} />);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(actions.drapeAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t dress the model just now.');

    actions.drapeAction.mockResolvedValueOnce({ drape: { id: DRAPE } });
    actions.drapeViewAction.mockResolvedValue({ ok: true });
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(actions.drapeAction).toHaveBeenCalledTimes(2);
    expect(main()).toHaveAttribute('src', `/api/try-on/drapes/${DRAPE}/image?view=front`);
  });
});
