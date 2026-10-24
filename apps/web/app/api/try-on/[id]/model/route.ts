import { apiImage } from '@/lib/api/server';
import { getAccessToken } from '@/lib/auth/session';

// The 3D model (GLB) of the signed-in user's own try-on (D-137), loaded by the 360° viewer. The browser never
// calls the API: this handler forwards the request with the user's token.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });
  if (!/^[a-f0-9]{24}$/.test(id)) return new Response(null, { status: 404 });
  const model = await apiImage(`/v1/try-on/jobs/${id}/model`, token, (type) => type === 'model/gltf-binary');
  if (!model) return new Response(null, { status: 404 });
  return new Response(model.bytes, {
    headers: {
      'content-type': model.contentType,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
