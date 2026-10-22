import type { LookPriceRange } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// The price range of one of the signed-in user's own looks, for its Shop My Look tab (#118). The browser
// never calls the API: this handler forwards the request with the user's token. The API searches store
// listings for the look's garments (cached for a day) and returns only ranges of the user's own looks.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const range = await apiRequest<LookPriceRange>(`/v1/outfits/${id}/price-range`, { token });
    return Response.json(range, { headers: { 'cache-control': 'private, no-store' } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    const code = err instanceof ApiError ? err.code : 'SERVICE_UNAVAILABLE';
    return Response.json({ error: code }, { status, headers: { 'cache-control': 'private, no-store' } });
  }
}
