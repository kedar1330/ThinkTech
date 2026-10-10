// Session cookie settings (SECURITY.md §1): HttpOnly, Secure with the __Secure- prefix over HTTPS,
// SameSite=Lax, host-only (no Domain attribute), 7-day maximum age matching the API token.

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** Secure cookies whenever the web app is served over HTTPS (staging and production). */
export function isSecureAuthUrl(authUrl: string | undefined = process.env.AUTH_URL): boolean {
  return typeof authUrl === 'string' && authUrl.startsWith('https://');
}

export function sessionCookieName(secure: boolean): string {
  return `${secure ? '__Secure-' : ''}authjs.session-token`;
}

export function sessionCookieOptions(secure: boolean) {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure };
}
