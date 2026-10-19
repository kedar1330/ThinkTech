import { randomInt, randomUUID } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { DRAFT_KEY } from '../../apps/web/lib/auth/draft';
import { SUBJECT, readOtp } from './outbox';

// Shared auth fixtures for every feature flow: create a verified user through the real UI, log in and
// out, and enter emailed codes. Import `test` and `expect` from here instead of '@playwright/test'.

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/**
 * Each test acts as a different visitor. The API rate-limits sign-ups and logins per client IP (D-38),
 * and the web app forwards the visitor's IP from X-Forwarded-For (apps/web/lib/auth/origin.ts), so every
 * test gets its own address from the 198.18.0.0/15 benchmarking range. Without this, parallel tests
 * and --repeat-each would share one IP and hit those limits.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({ extraHTTPHeaders }, use) => {
    const ip = `198.${18 + randomInt(2)}.${randomInt(256)}.${1 + randomInt(254)}`;
    await use({ ...extraHTTPHeaders, 'x-forwarded-for': ip });
  },
});

export { expect };

/** A new, unique user that meets the password policy (upper, lower, number, special, ≥ 8). */
export function newUser(): TestUser {
  const id = randomUUID().replace(/-/g, '').slice(0, 12);
  return { name: `E2E Tester ${id.slice(0, 4)}`, email: `e2e-${id}@example.com`, password: `Styl3-Me-${id}!` };
}

/** Another valid password, for change and reset flows. */
export function newPassword(): string {
  return `N3w-Pass-${randomUUID().slice(0, 8)}!`;
}

/** Types a 6-digit code into the six-box code entry inside `scope` (the whole page by default). */
export async function enterCode(scope: Page | Locator, code: string): Promise<void> {
  await scope.getByLabel('Digit 1 of 6').fill(code);
  await expect(scope.getByLabel('Digit 6 of 6')).toHaveValue(code.slice(-1));
}

/**
 * Fills and submits the registration form. Ends on "Verify your email"; returns the time just before
 * the submit, for reading the verification code with `readOtp(email, { since })`.
 */
export async function registerUser(page: Page, user: TestUser = newUser()): Promise<{ user: TestUser; since: number }> {
  await page.goto('/register');
  // The form renders empty on the server and remounts in the browser to restore a saved draft
  // (RegisterForm.tsx), so anything typed before that remount is lost. Only the remounted form saves
  // entries to the local draft: once the draft holds the name, the live form has it.
  await expect(async () => {
    await page.getByLabel('Full name').fill(user.name);
    expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).toContain(user.name);
  }).toPass({ timeout: 15_000 });
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm password').fill(user.password);
  await page.getByRole('combobox', { name: 'City' }).fill('Mumbai');
  await page.getByRole('option', { name: /^Mumbai/ }).click();
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  const since = Date.now();
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  return { user, since };
}

/** Enters the emailed verification code. Ends on "Email verified successfully", signed in. */
export async function verifyEmail(page: Page, email: string, since: number): Promise<void> {
  const code = await readOtp(email, { subject: SUBJECT.verifyEmail, since });
  await enterCode(page, code);
  await page.getByRole('button', { name: 'Verify email' }).click();
  await expect(page).toHaveURL(/\/verify-email\/success$/);
  await expect(page.getByRole('heading', { name: 'Email verified successfully' })).toBeVisible();
}

/** Registers and verifies a new user. Ends signed in on the first onboarding step (style profile). */
export async function signUp(page: Page, user: TestUser = newUser()): Promise<TestUser> {
  const { since } = await registerUser(page, user);
  await verifyEmail(page, user.email, since);
  await page.getByRole('link', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding\/style-profile$/);
  return user;
}

/** Registers, verifies and skips onboarding. Ends signed in on Home. */
export async function signUpAndSkipOnboarding(page: Page, user: TestUser = newUser()): Promise<TestUser> {
  await signUp(page, user);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/home\?skipped=1$/);
  return user;
}

/** Fills and submits the login form; the caller checks the outcome. */
export async function submitLogin(page: Page, email: string, password: string, { remember = false } = {}) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  if (remember) await page.getByRole('checkbox', { name: /Remember me/ }).check();
  await page.getByRole('button', { name: 'Log In' }).click();
}

/** Logs in and waits until the app has taken the user past the login page. */
export async function login(
  page: Page,
  user: Pick<TestUser, 'email' | 'password'>,
  options: { remember?: boolean } = {},
) {
  await submitLogin(page, user.email, user.password, options);
  await page.waitForURL((url) => url.pathname !== '/login');
}

/** Logs out from an app page (account menu) or an onboarding page. Ends on the login page. */
export async function logout(page: Page): Promise<void> {
  const accountMenu = page.getByRole('button', { name: /^Account menu for/ });
  if (await accountMenu.isVisible()) await accountMenu.click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login\?loggedOut=1$/);
}
