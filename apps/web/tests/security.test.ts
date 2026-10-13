import { describe, expect, it } from 'vitest';
import nextConfig, { resetPasswordHeaders } from '../next.config';
import { isSecureAuthUrl, sessionCookieName, sessionCookieOptions, SESSION_MAX_AGE_SECONDS } from '../lib/auth/cookies';
import { clientIpFrom, isAllowedOrigin } from '../lib/auth/origin';

// T-47 / T-48 (configuration level). The browser-level checks — the real Set-Cookie header over HTTPS
// and the reset page's network log — run in the Playwright suite against staging (TESTING.md §7).

describe('T-47: session cookie', () => {
  it('is HttpOnly, SameSite=Lax, host-only, and Secure with the __Secure- prefix over HTTPS', () => {
    expect(isSecureAuthUrl('https://styleme.example')).toBe(true);
    expect(sessionCookieName(true)).toBe('__Secure-authjs.session-token');
    expect(sessionCookieOptions(true)).toEqual({ httpOnly: true, sameSite: 'lax', path: '/', secure: true });
    expect(sessionCookieOptions(true)).not.toHaveProperty('domain');
  });

  it('is not Secure over plain HTTP (local development only)', () => {
    expect(isSecureAuthUrl('http://localhost:3000')).toBe(false);
    expect(sessionCookieName(false)).toBe('authjs.session-token');
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it('lasts at most 7 days, matching the API token', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
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
  });
});

describe('T-48: reset page headers', () => {
  it('sends Referrer-Policy: no-referrer and Cache-Control: no-store on /reset-password, after the global headers', async () => {
    const rules = await nextConfig.headers!();
    const resetIndex = rules.findIndex((r) => r.source === '/reset-password');
    const globalIndex = rules.findIndex((r) => r.source === '/:path*');
    expect(resetIndex).toBeGreaterThan(globalIndex);
    expect(rules[resetIndex]!.headers).toEqual(resetPasswordHeaders);
    expect(resetPasswordHeaders).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    expect(resetPasswordHeaders).toContainEqual({ key: 'Cache-Control', value: 'no-store' });
  });
});

describe('client IP forwarding', () => {
  it('takes the first X-Forwarded-For address', () => {
    expect(clientIpFrom(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientIpFrom(new Headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8');
    expect(clientIpFrom(new Headers())).toBeUndefined();
  });
});
