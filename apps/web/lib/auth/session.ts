import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getToken } from 'next-auth/jwt';
import type { UserResponse } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { isSecureAuthUrl, sessionCookieName } from './cookies';

/** The API token from the encrypted session cookie, or null. Server-only; never sent to the browser. */
export async function getAccessToken(): Promise<string | null> {
  const secure = isSecureAuthUrl();
  const name = sessionCookieName(secure);
  const token = await getToken({
    req: { headers: await headers() } as unknown as Request,
    secret: process.env.AUTH_SECRET,
    secureCookie: secure,
    cookieName: name,
    salt: name,
  });
  if (!token?.accessToken || !token.accessTokenExpires || Date.now() >= token.accessTokenExpires) return null;
  return token.accessToken;
}

/**
 * For protected pages (FR-AUTH-07): confirms the session with the API on every render, so a revoked
 * or expired session never shows protected data.
 */
export async function requireUser(): Promise<{ user: UserResponse; accessToken: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect('/login');
  try {
    const user = await apiRequest<UserResponse>('/v1/auth/me', { token: accessToken });
    return { user, accessToken };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    throw err;
  }
}
