import { describe, expect, it } from 'vitest';
import nextConfig, { TOKEN_PAGES, resetPasswordHeaders } from '../next.config';
import { SESSION_MAX_AGE_REMEMBER_SECONDS, cookieName, cookieOptions, isSecureAuthUrl } from '../lib/auth/cookies';
import { clientIpFrom, isAllowedOrigin } from '../lib/auth/origin';

// T-47 / T-48 (configuration level). The browser-level checks — the real Set-Cookie header over HTTPS
// and the reset page's network log — run in the Playwright suite against staging (TESTING.md §7).

describe('T-47: credential cookies (D-06, D-91)', () => {
  it('over HTTPS: HttpOnly, SameSite=Lax, Secure, host-only, with the __Host- prefix', () => {
    expect(isSecureAuthUrl('https://styleme.example')).toBe(true);
    expect(cookieName('session', true)).toBe('__Host-styleme_session');
    expect(cookieName('pending', true)).toBe('__Host-styleme_pending');
    const options = cookieOptions(SESSION_MAX_AGE_REMEMBER_SECONDS, true);
    expect(options).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 30 * 24 * 60 * 60 });
    expect(options).not.toHaveProperty('domain');
  });

  it('without Remember Me the session cookie has no Max-Age (ends when the browser closes)', () => {
    expect(cookieOptions(undefined, true)).not.toHaveProperty('maxAge');
    expect(cookieOptions(undefined, true)).not.toHaveProperty('expires');
  });

  it('over plain HTTP (local development only): not Secure, no prefix', () => {
    expect(isSecureAuthUrl('http://localhost:3000')).toBe(false);
    expect(isSecureAuthUrl(undefined)).toBe(false);
    expect(cookieName('session', false)).toBe('styleme_session');
    expect(cookieOptions(undefined, false).secure).toBe(false);
  });

  it('Remember Me lasts 30 days, matching the API session', () => {
    expect(SESSION_MAX_AGE_REMEMBER_SECONDS).toBe(30 * 24 * 60 * 60);
  });
});

describe('T-47: Origin check on state-changing requests', () => {
  const authUrl = 'https://styleme.example';
  it('accepts only the web app origin', () => {
    expect(isAllowedOrigin('https://styleme.example', authUrl)).toBe(true);
    expect(isAllowedOrigin('https://evil.example', authUrl)).toBe(false);
    expect(isAllowedOrigin('http://styleme.example', authUrl)).toBe(false);
    expect(isAllowedOrigin('https://styleme.example.evil.example', authUrl)).toBe(false);
    expect(isAllowedOrigin(null, authUrl)).toBe(false);
    expect(isAllowedOrigin('null', authUrl)).toBe(false);
    expect(isAllowedOrigin('https://styleme.example', undefined)).toBe(false);
    // New device accessing via host header / LAN IP
    expect(isAllowedOrigin('http://192.168.1.50:3000', 'http://localhost:3000', '192.168.1.50:3000')).toBe(true);
    expect(isAllowedOrigin('http://evil.example', 'http://localhost:3000', '192.168.1.50:3000')).toBe(false);
  });
});

describe('T-48: token page headers', () => {
  it('every page that handles a code or token sends no-referrer and no-store, after the global headers', async () => {
    const rules = await nextConfig.headers!();
    const globalIndex = rules.findIndex((r) => r.source === '/:path*');
    expect(resetPasswordHeaders).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    expect(resetPasswordHeaders).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
    for (const page of ['/reset-password', '/verify-email/link', '/settings/email/confirm', '/forgot-password/code']) {
      expect(TOKEN_PAGES).toContain(page);
      const index = rules.findIndex((r) => r.source === page);
      expect(index, page).toBeGreaterThan(globalIndex);
      expect(rules[index]!.headers).toEqual(resetPasswordHeaders);
    }
  });
});

describe('client IP forwarding', () => {
  it('takes the first X-Forwarded-For address', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8');
    expect(clientIpFrom(new Headers())).toBeUndefined();
  });
});
