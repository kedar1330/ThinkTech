import { apiImage } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// The shared cartoon avatar (D-138) for a Clothing Preference, undressed. The browser never calls the API:
// this handler forwards the request with the user's token. The picture is the same for everyone.
export async function GET(_request: Request, { params }: { params: Promise<{ department: string }> }) {
  const { department } = await params;
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  if (department !== 'women' && department !== 'men') return new Response(null, { status: 404 });
  const image = await apiImage(`/v1/try-on/avatars/${department}`, token);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      'content-type': image.contentType,
      'cache-control': 'private, no-cache, no-store, must-revalidate',
      'x-content-type-options': 'nosniff',
    },
  });
}
