import 'server-only';
import { BFF_KEY_HEADER, CLIENT_IP_HEADER, type Envelope, type ErrorCode } from '@styleme/contracts';

// Server-side API client (BFF). Browsers never call the API, and the access token never leaves the
// Next.js server.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** A raw (non-JSON) body, e.g. a photo upload (D-129); replaces `body`. */
  rawBody?: { bytes: Uint8Array; contentType: string };
  token?: string;
  clientIp?: string;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const baseUrl = process.env.API_BASE_URL;
  const bffSecret = process.env.BFF_SHARED_SECRET;
  if (!baseUrl || !bffSecret) throw new Error('API_BASE_URL and BFF_SHARED_SECRET must be set');

  const headers: Record<string, string> = {
    'content-type': options.rawBody?.contentType ?? 'application/json',
    [BFF_KEY_HEADER]: bffSecret,
    ...(options.headers ?? {}),
  };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.clientIp) headers[CLIENT_IP_HEADER] = options.clientIp;

  const isGet = !options.method || options.method === 'GET';
  const maxAttempts = isGet ? 2 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.rawBody
          ? new Blob([options.rawBody.bytes as Uint8Array<ArrayBuffer>])
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        cache: 'no-store',
      });
    } catch (err) {
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      console.error(`[BFF apiRequest] Could not reach StyleMe API backend at ${baseUrl}${path}:`, err);
      throw new ApiError(
        503,
        'SERVICE_UNAVAILABLE',
        process.env.NODE_ENV === 'development'
          ? `StyleMe API backend is temporarily unavailable at ${baseUrl}. Ensure 'pnpm dev:api' is running.`
          : 'StyleMe is temporarily unavailable',
      );
    }

    let json: Envelope<T>;
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      if (attempt < maxAttempts && res.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong');
    }

    if (!json.success) {
      if (attempt < maxAttempts && res.status === 503) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }
      throw new ApiError(res.status, json.error.code, json.error.message, json.error.retryAfterSeconds);
    }

    return json.data;
  }

  throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'StyleMe is temporarily unavailable');
}

/**
 * Fetches a raw image from the API (e.g. the user's own photo), or another file type that `accept` allows (a
 * try-on's 3D model); null when it is missing or not theirs.
 */
export async function apiImage(
  path: string,
  token: string,
  accept: (contentType: string) => boolean = (type) => type.startsWith('image/'),
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const baseUrl = process.env.API_BASE_URL;
  const bffSecret = process.env.BFF_SHARED_SECRET;
  if (!baseUrl || !bffSecret) throw new Error('API_BASE_URL and BFF_SHARED_SECRET must be set');
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { [BFF_KEY_HEADER]: bffSecret, authorization: `Bearer ${token}` },
    cache: 'no-store',
  }).catch(() => null);
  const contentType = res?.headers.get('content-type') ?? '';
  if (!res?.ok || !accept(contentType)) return null;
  return { bytes: await res.arrayBuffer(), contentType };
}

/**
 * Reads claims from an API token without verifying it (the API verifies on every request). Used only
 * to size the session cookie: `rm` says whether the session was created with Remember Me.
 */
export function decodeTokenClaims(token: string): { sub: string; exp: number; rm: boolean } | null {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
    return typeof payload.sub === 'string' && typeof payload.exp === 'number'
      ? { sub: payload.sub, exp: payload.exp, rm: payload.rm === true }
      : null;
  } catch {
    return null;
  }
}
