import {
  enterCode,
  expect,
  login,
  logout,
  newPassword,
  newUser,
  registerUser,
  signUp,
  submitLogin,
  test,
  verifyEmail,
} from './fixtures/auth';
import { SUBJECT, readOtp } from './fixtures/outbox';

// Authentication smoke flow (issue #36): every step goes through the real UI, server actions, API and
// database. Codes are read from the API's dev outbox.

/** AUTH_MESSAGES.loginFailed in packages/contracts/src/auth.ts. */
const LOGIN_FAILED = 'Incorrect email or password.';

test('register → verify → set up profile → change password → log out/in → reset password → delete account', async ({
  page,
}) => {
  const user = newUser();

  await test.step('register and verify the email with the emailed code', async () => {
    const { since } = await registerUser(page, user);
    await verifyEmail(page, user.email, since);
    await page.getByRole('link', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/style-profile$/);
  });

  await test.step('onboarding: set up the style profile, then finish the appearance step', async () => {
    await expect(page.getByRole('heading', { name: 'Tell us about your style' })).toBeVisible();
    await page.getByRole('radio', { name: 'Women' }).check();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/appearance$/);
    await page.getByRole('button', { name: 'Continue to my home' }).click();
    await expect(page).toHaveURL(/\/home\?welcome=1$/);
    await expect(page.getByText(/Your style profile is set up\./)).toBeVisible();
    // The department chosen during onboarding was saved to the profile.
    await page.goto('/profile');
    await expect(page.getByRole('radio', { name: 'Women' })).toBeChecked();
  });

  const changed = newPassword();
  await test.step('change the password with an emailed code', async () => {
    await page.goto('/settings');
    const section = page.locator('#password');
    const since = Date.now();
    await section.getByRole('button', { name: 'Email me a code' }).click();
    await expect(section.getByText(/We sent a 6-digit code to/)).toBeVisible();
    await enterCode(section, await readOtp(user.email, { subject: SUBJECT.passwordChangeCode, since }));
    await section.getByLabel('New password', { exact: true }).fill(changed);
    await section.getByLabel('Confirm new password').fill(changed);
    await section.getByRole('button', { name: 'Change password' }).click();
    await expect(section.getByText(/Your password has been changed\./)).toBeVisible();
  });

  await test.step('log out, then log in with the new password (the old one is rejected)', async () => {
    await page.goto('/home');
    await logout(page);
    await submitLogin(page, user.email, user.password);
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await login(page, { email: user.email, password: changed });
    await expect(page).toHaveURL(/\/home$/);
  });

  const reset = newPassword();
  await test.step('forgot password: reset it with an emailed code, then log in with it', async () => {
    await logout(page);
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByText('Email me a code').click();
    const since = Date.now();
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page).toHaveURL(/\/forgot-password\/code$/);
    await enterCode(page, await readOtp(user.email, { subject: SUBJECT.resetCode, since }));
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel('New password', { exact: true }).fill(reset);
    await page.getByLabel('Confirm new password').fill(reset);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page).toHaveURL(/\/login\?reset=1$/);
    await expect(page.getByText('Your password has been reset.', { exact: false })).toBeVisible();
    await submitLogin(page, user.email, changed);
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible();
    await login(page, { email: user.email, password: reset });
    await expect(page).toHaveURL(/\/home$/);
  });

  await test.step('delete the account with an emailed code and an explicit confirmation', async () => {
    await page.goto('/settings');
    const section = page.locator('#delete');
    const since = Date.now();
    await section.getByRole('button', { name: 'Email me a deletion code' }).click();
    await enterCode(section, await readOtp(user.email, { subject: SUBJECT.deletionCode, since }));
    await section.getByRole('checkbox', { name: /I understand my account/ }).check();
    await section.getByRole('button', { name: 'Delete my account…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete your account permanently?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Yes, delete' }).click();
    await expect(page).toHaveURL(/\/\?deleted=1$/);
  });

  await test.step('the deleted account can no longer log in', async () => {
    await submitLogin(page, user.email, reset);
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test('onboarding: "Skip for now" goes straight to Home', async ({ page }) => {
  const user = await signUp(page);
  await page.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page).toHaveURL(/\/home\?skipped=1$/);
  await expect(page.getByText(/You skipped the style profile for now\./)).toBeVisible();

  // Onboarding is finished: the user stays on Home after logging out and back in.
  await logout(page);
  await login(page, user);
  await expect(page).toHaveURL(/\/home$/);
});
