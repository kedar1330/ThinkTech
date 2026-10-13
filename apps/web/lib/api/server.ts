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
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string;
  clientIp?: string;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const baseUrl = process.env.API_BASE_URL;
  const bffSecret = process.env.BFF_SHARED_SECRET;
  if (!baseUrl || !bffSecret) throw new Error('API_BASE_URL and BFF_SHARED_SECRET must be set');

  const headers: Record<string, string> = { 'content-type': 'application/json', [BFF_KEY_HEADER]: bffSecret };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.clientIp) headers[CLIENT_IP_HEADER] = options.clientIp;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'StyleMe is temporarily unavailable');
  }

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong');
  }
  if (!json.success) throw new ApiError(res.status, json.error.code, json.error.message, json.error.retryAfterSeconds);
  return json.data;
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
