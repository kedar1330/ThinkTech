import { readFile } from 'node:fs/promises';
import type { Cookie, Page } from '@playwright/test';
import {
  expect,
  login,
  logout,
  newPassword,
  registerUser,
  signUpAndSkipOnboarding,
  test,
  verifyEmail,
} from './fixtures/auth';
import { SUBJECT, readLink } from './fixtures/outbox';
import { logFile } from './support/servers';
import { BASE_URL, LOCAL_SERVERS } from './support/settings';

// Browser-level checks for T-47 and T-48 (docs/TESTING.md §4). Their configuration-level halves are
// in apps/web/tests/security.test.ts.

const HTTPS = new URL(BASE_URL).protocol === 'https:';
/** `__Host-` prefix over HTTPS only (apps/web/lib/auth/cookies.ts). */
const cookieName = (base: string) => (HTTPS ? `__Host-${base}` : base);

/** HttpOnly, SameSite=Lax, Path=/, host-only; Secure exactly when served over HTTPS. */
function expectCredentialCookie(cookie: Cookie | undefined, name: string): asserts cookie is Cookie {
  expect(cookie, `${name} cookie`).toBeDefined();
  expect(cookie!.httpOnly, `${name} HttpOnly`).toBe(true);
  expect(cookie!.sameSite, `${name} SameSite`).toBe('Lax');
  expect(cookie!.path, `${name} Path`).toBe('/');
  // Playwright reports a cookie set with a Domain attribute as ".domain"; host-only cookies have no dot.
  expect(cookie!.domain.startsWith('.'), `${name} host-only`).toBe(false);
  expect(cookie!.secure, `${name} Secure`).toBe(HTTPS);
}

async function credentialCookies(page: Page): Promise<Cookie[]> {
  return (await page.context().cookies()).filter((c) => c.name.includes('styleme_'));
}

test.describe('T-47: credential cookies and cross-site requests', () => {
  test('cookies are HttpOnly, SameSite=Lax and host-only (Secure + __Host- over HTTPS); lifetime follows Remember Me', async ({
    page,
  }) => {
    if (!HTTPS) {
      test.info().annotations.push({
        type: 'note',
        description: `${BASE_URL} is plain HTTP, so the cookies are checked to be non-Secure without the __Host- prefix; run with an https BASE_URL (staging) to check Secure and __Host-.`,
      });
    }

    // The pending-registration cookie set by sign-up.
    const { user, since } = await registerUser(page);
    const pending = (await credentialCookies(page)).find((c) => c.name === cookieName('styleme_pending'));
    expectCredentialCookie(pending, 'pending');

    // The session cookie after verification. Remember Me was not ticked: a browser-session cookie.
    await verifyEmail(page, user.email, since);
    let session = (await credentialCookies(page)).find((c) => c.name === cookieName('styleme_session'));
    expectCredentialCookie(session, 'session');
    expect(session.expires, 'no Max-Age without Remember Me').toBe(-1);
    for (const cookie of await credentialCookies(page)) expectCredentialCookie(cookie, cookie.name);
    // Page scripts can't read any credential cookie.
    expect(await page.evaluate(() => document.cookie)).not.toContain('styleme_');

    // With Remember Me the session cookie lasts 30 days.
    await page.getByRole('link', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Skip for now' }).click();
    await expect(page).toHaveURL(/\/home\?skipped=1$/);
    await logout(page);
    await login(page, user, { remember: true });
    session = (await credentialCookies(page)).find((c) => c.name === cookieName('styleme_session'));
    expectCredentialCookie(session, 'session (Remember Me)');
    const days = (session.expires * 1000 - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
    for (const cookie of await credentialCookies(page)) expectCredentialCookie(cookie, cookie.name);
  });

  test('a server action posted from a foreign origin is rejected and changes nothing', async ({ page }) => {
    await signUpAndSkipOnboarding(page);

    // Capture the real "Log out" server-action request (without letting it through) so it can be
    // replayed with different Origin headers, using this browser's session cookie.
    let captured: { url: string; headers: Record<string, string>; body: Buffer } | undefined;
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && (await request.headerValue('next-action'))) {
        captured = { url: request.url(), headers: await request.allHeaders(), body: request.postDataBuffer()! };
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await page.getByRole('button', { name: /^Account menu for/ }).click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect.poll(() => captured).toBeDefined();
    await page.unrouteAll({ behavior: 'wait' });
    const action = captured!;

    const replay = (headers: Record<string, string>) =>
      page.request.post(action.url, {
        headers: {
          accept: action.headers['accept'] ?? 'text/x-component',
          'content-type': action.headers['content-type']!,
          'next-action': action.headers['next-action']!,
          ...(action.headers['next-router-state-tree']
            ? { 'next-router-state-tree': action.headers['next-router-state-tree'] }
            : {}),
          ...headers,
        },
        data: action.body,
        maxRedirects: 0,
      });
    const stillSignedIn = async () => {
      await page.goto('/settings');
      return new URL(page.url()).pathname === '/settings';
    };
    expect(await stillSignedIn()).toBe(true);

    // 1. A foreign Origin: rejected by Next.js's own Origin/Host check before the action runs.
    const foreign = await replay({ origin: 'https://evil.example' });
    expect(foreign.ok(), `foreign origin answered ${foreign.status()}`).toBe(false);
    expect(await stillSignedIn()).toBe(true);

    // 2. A foreign Origin that also forges X-Forwarded-Host gets past Next.js, but the app's own check
    //    (isAllowedOrigin against AUTH_URL) still blocks the action: the session survives.
    const forged = await replay({ origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' });
    expect(forged.status(), 'Next.js accepted the forged request, so the app-level check is what blocks it').toBe(200);
    expect(await stillSignedIn()).toBe(true);

    // Control: the same request from the app's own origin does log out, so the replay itself works.
    const own = await replay({ origin: new URL(BASE_URL).origin });
    expect(own.status()).toBeLessThan(400);
    expect(await stillSignedIn()).toBe(false);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('T-48: emailed reset link', () => {
  test('the token leaves the address bar, never reaches a server or Referer, and the page sends no-referrer', async ({
    page,
  }) => {
    const user = await signUpAndSkipOnboarding(page);
    await logout(page);

    await page.goto('/forgot-password');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    const since = Date.now();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText(/We sent a reset link\./)).toBeVisible();
    const link = await readLink(user.email, { subject: SUBJECT.resetLink, since });
    const token = new URL(link).hash.replace(/^#token=/, '');
    expect(token.length).toBeGreaterThan(20);

    // Record every request from here on: none may carry the token in its URL or Referer.
    const recorded: Promise<{ url: string; from: string; referer: string }>[] = [];
    page.on('request', (r) =>
      recorded.push(
        (async () => ({
          url: r.url(),
          // The page that made the request (for a navigation: the page being left).
          from: r.frame().url(),
          referer: (await r.headerValue('referer')) ?? '',
        }))(),
      ),
    );

    const response = await page.goto(link);
    expect(response?.headers()['referrer-policy']).toBe('no-referrer');
    expect(response?.headers()['cache-control']).toContain('no-store');
    // The page reads the token from the fragment once, then removes it from the address bar.
    await expect(page).toHaveURL(`${BASE_URL}/reset-password`);
    expect(await page.evaluate(() => window.location.href)).not.toContain(token);

    const password = newPassword();
    await page.getByLabel('New password', { exact: true }).fill(password);
    await page.getByLabel('Confirm new password').fill(password);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/login\?reset=1$/);
    expect(page.url()).not.toContain(token);

    // The link works once: opening it again and submitting is refused.
    await page.goto(link);
    await expect(page).toHaveURL(`${BASE_URL}/reset-password`);
    await page.getByLabel('New password', { exact: true }).fill(password);
    await page.getByLabel('Confirm new password').fill(password);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText(/invalid, has expired or was already used/)).toBeVisible();
    expect(page.url()).not.toContain(token);

    const sent = await Promise.all(recorded);
    const fromResetPage = sent.filter((r) => new URL(r.from).pathname === '/reset-password');
    expect(fromResetPage.length, 'requests made by the reset page').toBeGreaterThan(0);
    for (const request of sent) {
      expect(request.url, 'request URL').not.toContain(token);
      expect(request.referer, `Referer of ${request.url}`).not.toContain(token);
    }
    // Under Referrer-Policy: no-referrer, nothing the reset page requests carries a Referer at all.
    for (const request of fromResetPage) expect(request.referer, `Referer of ${request.url}`).toBe('');

    // The servers' logs never contain the token (only checkable when this run started the servers).
    if (LOCAL_SERVERS) {
      await expect
        .poll(async () => (await readFile(logFile('api'), 'utf8')).includes('/v1/auth/password-reset/confirm'))
        .toBe(true);
      for (const server of ['api', 'web']) {
        expect(await readFile(logFile(server), 'utf8'), `${server} log`).not.toContain(token);
      }
    }
  });
});
