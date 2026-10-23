// Cross-site request protection (SECURITY.md §1): every state-changing server action checks that the
// request's Origin is the web app's own origin. Missing or malformed origins are rejected.

export function isAllowedOrigin(
  origin: string | null | undefined,
  authUrl: string | undefined,
  host?: string | null,
): boolean {
  if (!origin || origin === 'null') return false;
  try {
    const originUrl = new URL(origin);
    if (authUrl) {
      try {
        if (originUrl.origin === new URL(authUrl).origin) return true;
      } catch {
        // Fall through to host-based matching
      }
    }
    if (host) {
      const normalizedHost = host.trim().toLowerCase();
      if (originUrl.host.toLowerCase() === normalizedHost) {
        if (
          !authUrl ||
          originUrl.protocol === new URL(authUrl).protocol ||
          originUrl.hostname === 'localhost' ||
          originUrl.hostname === '127.0.0.1' ||
          /^192\.168\./.test(originUrl.hostname) ||
          /^10\./.test(originUrl.hostname) ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(originUrl.hostname)
        ) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** The end user's IP as reported by the hosting platform, forwarded to the API for rate limits. */
export function clientIpFrom(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || undefined;
}
