import type { TryOnJob } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// One of the signed-in user's own try-ons (D-137), polled by the try-on page while it runs. The browser never
// calls the API: this handler forwards the request with the user's token, and each poll lets the API move
// the try-on on when fal.ai has finished a step.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
  try {
    const job = await apiRequest<TryOnJob>(`/v1/try-on/jobs/${id}`, { token });
    return Response.json(job, { headers: { 'cache-control': 'private, no-store' } });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 503;
    const code = err instanceof ApiError ? err.code : 'SERVICE_UNAVAILABLE';
    return Response.json({ error: code }, { status, headers: { 'cache-control': 'private, no-store' } });
  }
}
