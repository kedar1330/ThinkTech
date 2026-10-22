import { apiImage } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// Shows the signed-in user their own stored photo (D-129). The browser never calls the API: this handler
// forwards the request with the user's token, and the API returns only photos that belong to them.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response(null, { status: 404 });
  const image = await apiImage(`/v1/photos/${id}/image`, token);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      'content-type': image.contentType,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
