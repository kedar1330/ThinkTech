import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shop My Look actions (#43) with the API client mocked.

const ORIGIN = 'https://styleme.example';
const request = vi.hoisted(() => ({ origin: 'https://styleme.example' as string | null }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(request.origin ? { origin: request.origin } : {}),
  cookies: async () => ({ get: () => ({ value: 'access-token' }) }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (actual) => ({ ...(await actual<object>()), apiRequest: api.apiRequest }));

import { ApiError } from '@/lib/api/server';
import { attachItemAction, detachItemAction } from '@/app/actions/shop';

const ITEM = 'a'.repeat(24);
const LOOK = 'b'.repeat(24);

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN;
  request.origin = ORIGIN;
  api.apiRequest.mockReset();
});

describe('attachItemAction', () => {
  it('puts the item on the slot of the look', async () => {
    api.apiRequest.mockResolvedValue({});
    const state = await attachItemAction(undefined, form({ itemId: ITEM, outfitId: LOOK, slotId: 'accessory-2' }));
    expect(state).toEqual({ success: 'Added to the look.' });
    expect(api.apiRequest).toHaveBeenCalledWith(`/v1/shortlist/${ITEM}/attach`, {
      method: 'PUT',
      body: { outfitId: LOOK, slotId: 'accessory-2' },
      token: 'access-token',
    });
  });

  it('shows the API’s conflict message, and a gone message for a look that no longer exists', async () => {
    api.apiRequest.mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'That part of the look already has an item.'));
    expect((await attachItemAction(undefined, form({ itemId: ITEM, outfitId: LOOK, slotId: 'top' })))?.error).toBe(
      'That part of the look already has an item.',
    );
    api.apiRequest.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Not found'));
    expect((await attachItemAction(undefined, form({ itemId: ITEM, outfitId: LOOK, slotId: 'top' })))?.error).toBe(
      'This item or look is no longer available.',
    );
  });

  it('asks for an item when none is chosen, and calls nothing for a bad look or another origin', async () => {
    expect(await attachItemAction(undefined, form({ itemId: '', outfitId: LOOK, slotId: 'top' }))).toEqual({
      error: 'Choose an item from your shortlist.',
    });
    expect((await attachItemAction(undefined, form({ itemId: ITEM, outfitId: 'x', slotId: 'top' })))?.error).toBe(
      'This item or look is no longer available.',
    );
    request.origin = 'https://evil.example';
    expect((await attachItemAction(undefined, form({ itemId: ITEM, outfitId: LOOK, slotId: 'top' })))?.error).toMatch(
      /blocked/,
    );
    expect(api.apiRequest).not.toHaveBeenCalled();
  });
});

describe('detachItemAction', () => {
  it('takes the item off its look', async () => {
    api.apiRequest.mockResolvedValue({});
    const state = await detachItemAction(undefined, form({ itemId: ITEM }));
    expect(state?.success).toMatch(/still in your shortlist/);
    expect(api.apiRequest).toHaveBeenCalledWith(`/v1/shortlist/${ITEM}/attach`, {
      method: 'DELETE',
      token: 'access-token',
    });
  });
});
