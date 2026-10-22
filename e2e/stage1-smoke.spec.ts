import { enterCode, expect, newUser, registerUser, submitLogin, test, verifyEmail } from './fixtures/auth';
import { looksForDesign } from './fixtures/discover';
import { SUBJECT, readOtp } from './fixtures/outbox';

// Full Stage 1 E2E Smoke (issue #59, AC-17):
// register ─▶ verify ─▶ onboarding ─▶ request looks (#47) ─▶ save (#41) ─▶ shortlist + attach (#43) ─▶ delete account
// Covers the entire Stage 1 user journey in real browser environments at 375×812 and 1280×800.

const LOGIN_FAILED = 'Incorrect email or password.';

test('Stage 1 full smoke journey: register → onboarding → request looks → save → shortlist + attach → delete account', async ({
  page,
}) => {
  const user = newUser();

  await test.step('register and verify the email with the emailed code', async () => {
    const { since } = await registerUser(page, user);
    await verifyEmail(page, user.email, since);
    await page.getByRole('link', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/style-profile$/);
  });

  await test.step('onboarding: complete style profile and finish appearance step', async () => {
    await expect(page.getByRole('heading', { name: 'Tell us about your style' })).toBeVisible();
    await page.getByRole('radio', { name: 'Women' }).check();
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page).toHaveURL(/\/onboarding\/appearance$/);
    await page.getByRole('button', { name: 'Continue to my home' }).click();
    await expect(page).toHaveURL(/\/home\?welcome=1$/);
    await expect(page.getByText(/Your style profile is set up\./)).toBeVisible();
  });

  let shopUrl = '';
  await test.step('request personalised looks and save the first look', async () => {
    const results = await looksForDesign(page);
    await expect(results).toBeVisible();
    const firstLook = results.getByRole('article', { name: 'Look 1' });
    await expect(firstLook).toBeVisible();

    await firstLook.getByRole('button', { name: 'Save to Saved Outfits' }).click();
    await expect(firstLook.getByRole('status')).toHaveText(/Saved to Saved Outfits\./);

    await firstLook.getByRole('link', { name: 'Shop this look' }).click();
    await expect(page).toHaveURL(/\/shop\?outfitId=[a-f0-9]{24}$/);
    await expect(page.getByText('Product data unavailable')).toBeVisible();
    shopUrl = page.url();
  });

  await test.step('add an item to shortlist and attach it to the saved look', async () => {
    await page.goto('/shortlist');
    await page.getByLabel('Item name').fill('Smoke Silk Kurta');
    await page.getByLabel('Price you saw (₹)').fill('1299.50');
    await page.getByLabel('Link').fill('https://shop.example/smoke-kurta');
    await page.getByRole('button', { name: 'Add to shortlist' }).click();
    await expect(page.getByText('“Smoke Silk Kurta” was added to your shortlist.')).toBeVisible();

    await page.goto(shopUrl);
    const part = page.getByRole('list', { name: 'Parts of this look' }).locator(':scope > li').first();
    await part.getByRole('combobox').selectOption({ label: 'Smoke Silk Kurta — ₹1,299.50' });
    await part.getByRole('button', { name: 'Add to look' }).click();

    await expect(part.getByText('Smoke Silk Kurta')).toBeVisible();
    await expect(part.getByText('Added by you — not verified by StyleMe')).toBeVisible();

    const summary = page.getByRole('group', { name: 'Price summary' });
    await expect(summary).toContainText('₹1,299.50');
    await expect(summary).toContainText('Total of prices you entered — not verified by StyleMe; not a checkout price');
  });

  await test.step('delete account with emailed code and explicit confirmation dialog', async () => {
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

  await test.step('deleted account can no longer log in', async () => {
    await page.goto('/login');
    await submitLogin(page, user.email, user.password);
    await expect(page.getByText(LOGIN_FAILED)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
