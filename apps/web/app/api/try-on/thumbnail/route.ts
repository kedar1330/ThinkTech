import { getAccessToken } from '@/lib/auth/session';

// The Google-hosted store thumbnail of a Shop My Look item, served from our own origin so the try-on page can
// read its main colour for the 3D mannequin (a cross-origin image can't be read in a canvas). Only for
// signed-in users and only https *.gstatic.com thumbnails, the only image host search listings may use
// (`productListingSchema`), so this is never an open proxy. Nothing about the user is sent.

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;

export async function GET(request: Request) {
  const token = await getAccessToken();
  if (!token) return new Response(null, { status: 401 });

  let url: URL;
  try {
    url = new URL(new URL(request.url).searchParams.get('url') ?? '');
  } catch {
    return new Response(null, { status: 400 });
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.gstatic.com') || url.href.length > 2048) {
    return new Response(null, { status: 400 });
  }

  const res = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept: 'image/*' },
  }).catch(() => null);
  const contentType = res?.headers.get('content-type') ?? '';
  if (!res?.ok || !contentType.startsWith('image/')) return new Response(null, { status: 502 });
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return new Response(null, { status: 502 });
  return new Response(bytes, {
    headers: {
      'content-type': contentType,
      'cache-control': 'private, max-age=86400',
      'x-content-type-options': 'nosniff',
    },
  });
}
