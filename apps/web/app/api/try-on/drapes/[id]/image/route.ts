import { drapeViewSchema } from '@styleme/contracts';
import { apiImage } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// One view (`?view=front|three_quarter|side|back`, default front) of the signed-in user's own dressed model
// (D-138, D-139). The browser never calls the API: this handler forwards the request with the user's token, and
// the API returns only the user's own pictures.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response(null, { status: 404 });
  const view = drapeViewSchema.catch('front').parse(new URL(request.url).searchParams.get('view'));
  const image = await apiImage(`/v1/try-on/drapes/${id}/image?view=${view}`, token);
  if (!image) return new Response(null, { status: 404 });
  return new Response(image.bytes, {
    headers: {
      'content-type': image.contentType,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
