// Cross-site request protection (SECURITY.md §1): every state-changing server action checks that the
// request's Origin is the web app's own origin. Missing or malformed origins are rejected.

export function isAllowedOrigin(origin: string | null | undefined, authUrl: string | undefined): boolean {
  if (!origin || !authUrl) return false;
  try {
    return new URL(origin).origin === new URL(authUrl).origin;
  } catch {
    return false;
  }
}

/** The end user's IP as reported by the hosting platform, forwarded to the API for rate limits. */
export function clientIpFrom(headers: Headers): string | undefined {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || undefined;
}
