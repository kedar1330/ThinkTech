import type { LookProductMatches } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// Similar products for one of the signed-in user's own looks, for Shop My Look (#120). The browser never
// calls the API: this handler forwards the request with the user's token. The API reuses the store searches
// behind the price range (#118), cached for a day, and returns only products for the user's own looks.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const matches = await apiRequest<LookProductMatches>(`/v1/outfits/${id}/products`, { token });
    if (matches && Array.isArray(matches.slots)) {
      for (const slot of matches.slots) {
        if ((slot.slotId as string) === 'one_piece') {
          (slot as { slotId: string }).slotId = 'one-piece';
        }
      }
    }
    return Response.json(matches, { headers: { 'cache-control': 'private, no-store' } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    const code = err instanceof ApiError ? err.code : 'SERVICE_UNAVAILABLE';
    return Response.json({ error: code }, { status, headers: { 'cache-control': 'private, no-store' } });
  }
}
