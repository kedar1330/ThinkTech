import { apiImage } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// The AI outfit image of one of the signed-in user's own looks. The browser never calls the API: this
// handler forwards the request with the user's token, and the API makes the image on first view (which can
// take up to a minute) and returns only images of looks that belong to the user.
export const maxDuration = 90;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response(null, { status: 404 });
  const image = await apiImage(`/v1/outfits/${id}/image`, token);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      'content-type': image.contentType,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
