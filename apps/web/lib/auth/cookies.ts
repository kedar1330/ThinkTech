// Cookie settings (SECURITY.md §1, D-06, D-91). Every cookie that carries a credential is HttpOnly,
// SameSite=Lax and host-only; over HTTPS (staging and production) it is Secure and uses the `__Host-`
// prefix, which browsers only accept with Secure, Path=/ and no Domain attribute.

export const SESSION_MAX_AGE_REMEMBER_SECONDS = 30 * 24 * 60 * 60;
/** Pending-registration cookie: lets the registering browser finish verification (24 h). */
export const PENDING_MAX_AGE_SECONDS = 24 * 60 * 60;
/** OAuth state/PKCE/nonce cookie for the Google round trip. */
export const OAUTH_MAX_AGE_SECONDS = 10 * 60;
/** Reset token handed over between the "enter code" and "new password" steps. */
export const RESET_MAX_AGE_SECONDS = 10 * 60;

/** Secure cookies whenever the web app is served over HTTPS (staging and production). */
export function isSecureAuthUrl(authUrl: string | undefined = process.env.AUTH_URL): boolean {
  return typeof authUrl === 'string' && authUrl.startsWith('https://');
}

export type CookieKind = 'session' | 'pending' | 'pendingEmail' | 'oauth' | 'reset';

const BASE_NAMES: Record<CookieKind, string> = {
  session: 'styleme_session',
  pending: 'styleme_pending',
  pendingEmail: 'styleme_pending_email',
  oauth: 'styleme_oauth',
  reset: 'styleme_reset',
};

export function cookieName(kind: CookieKind, secure = isSecureAuthUrl()): string {
  return `${secure ? '__Host-' : ''}${BASE_NAMES[kind]}`;
}

/**
 * Options for a credential cookie. `maxAge` undefined makes a browser-session cookie, which is what a
 * session without Remember Me uses: it ends when the browser closes (the server also stops accepting
 * it after 24 hours).
 */
export function cookieOptions(maxAge: number | undefined, secure = isSecureAuthUrl()) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure,
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}
