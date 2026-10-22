import { beforeEach, describe, expect, it, vi } from 'vitest';

// "Shop this look" from Discover My Style (#115): saves the look, so it becomes a Shop My Look tab, then
// opens it there. The API client is mocked.

const ORIGIN = 'https://styleme.example';
const request = vi.hoisted(() => ({ origin: 'https://styleme.example' as string | null }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(request.origin ? { origin: request.origin } : {}),
  cookies: async () => ({ get: () => ({ value: 'access-token' }) }),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock('next/cache', () => cache);
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }),
}));
vi.mock('next/navigation', () => nav);
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (actual) => ({ ...(await actual<object>()), apiRequest: api.apiRequest }));

import { ApiError } from '@/lib/api/server';
import { shopLookAction } from '@/app/actions/outfits';

const LOOK = 'b'.repeat(24);
const form = (outfitId: string) => {
  const data = new FormData();
  data.set('outfitId', outfitId);
  return data;
};

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN;
  request.origin = ORIGIN;
  api.apiRequest.mockReset();
  nav.redirect.mockClear();
  cache.revalidatePath.mockClear();
});

describe('shopLookAction', () => {
  it('saves the look, then opens it in Shop My Look', async () => {
    api.apiRequest.mockResolvedValue({ id: LOOK, status: 'saved' });
    await expect(shopLookAction(undefined, form(LOOK))).rejects.toThrow(`REDIRECT /shop?outfitId=${LOOK}`);
    expect(api.apiRequest).toHaveBeenCalledWith(`/v1/outfits/${LOOK}/save`, { method: 'POST', token: 'access-token' });
    expect(cache.revalidatePath).toHaveBeenCalledWith('/shop');
  });

  it('stays on the results with the message when saving fails', async () => {
    api.apiRequest.mockRejectedValueOnce(new ApiError(409, 'CONFLICT', 'You can keep up to 1,000 saved items.'));
    expect((await shopLookAction(undefined, form(LOOK)))?.error).toBe('You can keep up to 1,000 saved items.');
    api.apiRequest.mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Not found'));
    expect((await shopLookAction(undefined, form(LOOK)))?.error).toBe('This look is no longer available.');
    expect(nav.redirect).not.toHaveBeenCalled();
  });

  it('calls nothing for a bad look ID or another origin', async () => {
    expect((await shopLookAction(undefined, form('nope')))?.error).toBe('This look is no longer available.');
    request.origin = 'https://evil.example';
    expect((await shopLookAction(undefined, form(LOOK)))?.error).toMatch(/blocked/);
    expect(api.apiRequest).not.toHaveBeenCalled();
  });
});
