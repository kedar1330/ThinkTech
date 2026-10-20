import type { Page } from '@playwright/test';
import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';

// Discover My Style looks flow (#45 – #48, issue #53) on the shipped, founder-approved style library.
// Users skip onboarding, so they have no department and no sizes saved.

async function requestLooks(page: Page, occasion: string, options: { wearType?: string } = {}) {
  await page.goto('/discover/looks');
  await expect(page.getByRole('heading', { name: 'Find looks for an occasion' })).toBeVisible();
  await page.getByRole('radio', { name: occasion }).check();
  if (options.wearType) await page.getByRole('checkbox', { name: options.wearType }).check();
  await page.getByRole('button', { name: 'Show me looks' }).click();
  return page.getByRole('region', { name: 'Your looks' });
}

test('journey: occasion → ranked looks → why this works → alternatives → copy a search phrase', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUpAndSkipOnboarding(page);

  const results = await test.step('request looks for an occasion', () => requestLooks(page, 'Everyday'));

  await test.step('up to 5 looks in ranking order, each explained', async () => {
    const looks = results.getByRole('article');
    await expect(looks).toHaveCount(5);
    for (let i = 0; i < 5; i++) {
      await expect(looks.nth(i).getByRole('heading', { name: `Look ${i + 1}` })).toBeVisible();
      await expect(looks.nth(i).getByText('Why this works')).toBeVisible();
    }
  });

  const first = results.getByRole('article', { name: 'Look 1' });
  const firstItem = first.getByRole('list', { name: 'Items in this look' }).locator(':scope > li').first();

  await test.step('size note asks for a size when none is saved', async () => {
    await expect(firstItem.getByRole('link', { name: 'Add your size' })).toHaveAttribute('href', '/profile#sizes');
  });

  await test.step('open the alternatives for an item', async () => {
    const summary = firstItem.getByText(/^\d+ alternatives?$/);
    await summary.click();
    const alternatives = firstItem.getByRole('list', { name: 'Alternatives' });
    await expect(alternatives).toBeVisible();
    const count = await alternatives.locator(':scope > li').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
    if (count < 3) await expect(firstItem.getByText(/^Only \d suitable alternatives? (was|were) found/)).toBeVisible();
  });

  await test.step('copy the search phrase', async () => {
    const copy = firstItem.getByRole('button', { name: /^Copy search phrase: / }).first();
    const phrase = (await copy.getAttribute('aria-label'))!.replace('Copy search phrase: ', '');
    await copy.click();
    await expect(firstItem.getByText('Copied').first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(phrase);
  });
});

test('no department: the summary and the results say no department filter is applied', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  const results = await requestLooks(page, 'Work');
  await expect(page.getByText('No department filter applied: looks can come from every department.')).toHaveCount(2);
  await expect(results.getByRole('article')).not.toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile#style-profile');
});

test('INSUFFICIENT_MATCHES: a request with no matching looks says what to change', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  // On the shipped library (C0 + C1) there are no fusion looks for work.
  const results = await requestLooks(page, 'Work', { wearType: 'Fusion' });
  await expect(
    results.getByText('No looks matched this request. Choose another wear type, or none to see all three.'),
  ).toBeVisible();
  await expect(results.getByRole('article')).toHaveCount(0);
});

test('a missing occasion is reported on the field', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  await page.goto('/discover/looks');
  await page.getByRole('button', { name: 'Show me looks' }).click();
  await expect(page.getByText('Choose an occasion.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your looks' })).toHaveCount(0);
});

test('responsive: the form and the looks fit at 320, 390, 768 and 1366 px', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  const results = await requestLooks(page, 'Festive');
  await expect(results.getByRole('article')).toHaveCount(5);
  // Open every alternatives panel, so the widest content is on the page.
  for (const summary of await results.getByText(/^\d+ alternatives?$/).all()) await summary.click();

  for (const width of [320, 390, 768, 1366]) {
    await test.step(`${width} px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      await expect(results.getByRole('article').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width} px`).toBeLessThanOrEqual(0);
    });
  }
});

test('regenerate: after a profile change, new looks say what changed (#49)', async ({ page, context }) => {
  await signUpAndSkipOnboarding(page);
  const results = await requestLooks(page, 'Work');
  await expect(results.getByRole('article')).not.toHaveCount(0);

  await test.step('change the profile in another tab', async () => {
    const profile = await context.newPage();
    await profile.goto('/profile');
    await profile.getByRole('radio', { name: 'Show me everything' }).check();
    await profile.locator('select[name="color_maroon"]').selectOption('avoid');
    await profile.getByRole('button', { name: 'Save style profile' }).click();
    await expect(profile.getByText('Your style profile has been saved.')).toBeVisible();
    await profile.close();
  });

  await test.step('regenerate with the current profile', async () => {
    await results.getByRole('button', { name: 'Regenerate with my current profile' }).click();
    const regenerated = page.getByRole('region', { name: 'Regenerated looks' });
    await expect(regenerated.getByText('What changed')).toBeVisible();
    await expect(regenerated.getByText('You chose a department: Show me everything.')).toBeVisible();
    await expect(regenerated.getByText('Your avoided colours now include maroon.')).toBeVisible();
    await expect(regenerated.getByRole('article')).not.toHaveCount(0);
  });
});
