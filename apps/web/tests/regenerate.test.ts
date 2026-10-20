import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LookInputs, OutfitDetail, RecommendationResponse } from '@styleme/contracts';

// regenerateAction (#49) with the API client mocked: it re-runs the original request, compares the inputs
// and never changes the original look.

const ORIGIN = 'https://styleme.example';
const request = vi.hoisted(() => ({ origin: 'https://styleme.example' as string | null }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(request.origin ? { origin: request.origin } : {}),
  cookies: async () => ({ get: () => ({ value: 'access-token' }) }),
}));
const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api/server', async (actual) => ({ ...(await actual<object>()), apiRequest: api.apiRequest }));

import { ApiError } from '@/lib/api/server';
import { regenerateAction } from '@/app/actions/discover';

const SAVED_ID = 'a'.repeat(24);
const NEW_ID = 'b'.repeat(24);

const INPUTS: LookInputs = {
  department: 'women',
  departmentFiltered: true,
  likedColors: ['navy'],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  fitPreferences: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null },
  coveragePreferences: { minSleeveLength: null, minNecklineCoverage: null, minGarmentLength: null },
  fabricPreferences: { liked: [], avoided: [] },
  preferredStyles: [],
  sizesSaved: [],
  signalsUsed: false,
};

const detail = (id: string, inputsUsed: LookInputs) =>
  ({ id, request: { occasion: 'work', paletteMode: 'suggested' }, inputsUsed }) as unknown as OutfitDetail;
const response = (ids: string[]) =>
  ({
    recommendationId: 'c'.repeat(24),
    looks: ids.map((id) => ({ id })),
    defaultsApplied: [],
    conflicts: [],
  }) as unknown as RecommendationResponse;

function form(outfitId: string) {
  const data = new FormData();
  data.set('outfitId', outfitId);
  return data;
}

/** Routes mocked API calls by method and path. */
function serve(routes: Record<string, unknown>) {
  api.apiRequest.mockImplementation(async (path: string, options: { method?: string } = {}) => {
    const key = `${options.method ?? 'GET'} ${path}`;
    if (!(key in routes)) throw new Error(`unexpected API call ${key}`);
    const value = routes[key];
    if (value instanceof Error) throw value;
    return value;
  });
}

beforeEach(() => {
  process.env.AUTH_URL = ORIGIN;
  request.origin = ORIGIN;
  api.apiRequest.mockReset();
});

describe('regenerateAction', () => {
  it('re-runs the original request with the latest profile and lists what changed', async () => {
    serve({
      [`GET /v1/outfits/${SAVED_ID}`]: detail(SAVED_ID, INPUTS),
      'POST /v1/recommendations': response([NEW_ID]),
      [`GET /v1/outfits/${NEW_ID}`]: detail(NEW_ID, { ...INPUTS, dislikedColors: ['maroon'] }),
    });
    const state = await regenerateAction(undefined, form(SAVED_ID));

    expect(state?.changes).toEqual(['Your avoided colours now include maroon.']);
    expect(state?.result?.looks).toEqual([{ id: NEW_ID }]);
    expect(api.apiRequest).toHaveBeenCalledWith('/v1/recommendations', {
      method: 'POST',
      body: { occasion: 'work', paletteMode: 'suggested' },
      token: 'access-token',
    });
  });

  it('only reads the original look: no save, update or delete (FR-OUT-05)', async () => {
    serve({
      [`GET /v1/outfits/${SAVED_ID}`]: detail(SAVED_ID, INPUTS),
      'POST /v1/recommendations': response([NEW_ID]),
      [`GET /v1/outfits/${NEW_ID}`]: detail(NEW_ID, INPUTS),
    });
    await regenerateAction(undefined, form(SAVED_ID));
    const calls = api.apiRequest.mock.calls.map(([path, options]) => `${options?.method ?? 'GET'} ${path}`);
    expect(calls).toEqual([`GET /v1/outfits/${SAVED_ID}`, 'POST /v1/recommendations', `GET /v1/outfits/${NEW_ID}`]);
  });

  it('compares with the current profile when the new request gives no looks', async () => {
    serve({
      [`GET /v1/outfits/${SAVED_ID}`]: detail(SAVED_ID, INPUTS),
      'POST /v1/recommendations': response([]),
      'GET /v1/profile': {
        department: 'men',
        sizes: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null },
        fitPreferences: INPUTS.fitPreferences,
        likedColors: ['navy'],
        dislikedColors: [],
        contrastPreference: null,
        silhouettePreferences: [],
        coveragePreferences: INPUTS.coveragePreferences,
        comfortPreferences: [],
        fabricPreferences: { liked: [], avoided: [] },
        preferredStyles: [],
        preferredOccasions: [],
        budgetPreference: null,
        updatedAt: null,
      },
    });
    const state = await regenerateAction(undefined, form(SAVED_ID));
    expect(state?.changes).toEqual(['Your department changed from Women to Men.']);
    expect(state?.result?.looks).toEqual([]);
  });

  it('says the look is gone when it no longer exists, and keeps earlier regenerated looks', async () => {
    serve({ [`GET /v1/outfits/${SAVED_ID}`]: new ApiError(404, 'NOT_FOUND', 'Not found') });
    const earlier = { result: response([NEW_ID]), changes: ['Your avoided colours now include maroon.'] };
    const state = await regenerateAction(earlier, form(SAVED_ID));
    expect(state).toMatchObject({ error: 'This look is no longer available.', ...earlier });
  });

  it('blocks a request from another origin and rejects a malformed ID without calling the API', async () => {
    request.origin = 'https://evil.example';
    expect((await regenerateAction(undefined, form(SAVED_ID)))?.error).toMatch(/blocked/);
    request.origin = ORIGIN;
    expect(await regenerateAction(undefined, form('not-an-id'))).toEqual({
      error: 'This look is no longer available.',
    });
    expect(api.apiRequest).not.toHaveBeenCalled();
  });
});
