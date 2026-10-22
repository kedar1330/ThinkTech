import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';
import { looksForDesign } from './fixtures/discover';

// Discover My Style looks flow (#45 – #48, issue #53; built from Outfit Categories, D-132) on the shipped,
// founder-approved style library. Users skip onboarding, so they have no department and no sizes saved.

/** `MAX_LOOKS` in packages/contracts/src/outfit.ts. */
const MAX_LOOKS = 3;

test('journey: saved design → ranked looks → why this works → copy a search phrase', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signUpAndSkipOnboarding(page);

  const results = await test.step('save a design and request looks', () => looksForDesign(page));

  await test.step(`up to ${MAX_LOOKS} looks in ranking order, each explained`, async () => {
    const looks = results.getByRole('article');
    await expect(looks.first()).toBeVisible();
    const count = await looks.count();
    expect(count).toBeLessThanOrEqual(MAX_LOOKS);
    for (let i = 0; i < count; i++) {
      await expect(looks.nth(i).getByRole('heading', { name: `Look ${i + 1}` })).toBeVisible();
      await expect(looks.nth(i).getByText('Why this works')).toBeVisible();
    }
  });

  const first = results.getByRole('article', { name: 'Look 1' });
  const firstItem = first.getByRole('list', { name: 'Items in this look' }).locator(':scope > li').first();

  await test.step('size note asks for a size when none is saved', async () => {
    await expect(firstItem.getByRole('link', { name: 'Add your size' })).toHaveAttribute('href', '/profile#sizes');
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
  const results = await looksForDesign(page, { occasion: 'Office' });
  await expect(page.getByText('No department filter applied: looks can come from every department.')).toHaveCount(2);
  await expect(results.getByRole('article')).not.toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit profile' })).toHaveAttribute('href', '/profile#basics');
});

test('INSUFFICIENT_MATCHES: a request with no matching looks says so', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  // On the shipped library (C0 + C1) there are no fusion looks for work.
  const results = await looksForDesign(page, { garment: 'tunic', outfit: 'fusion', occasion: 'Office' });
  await expect(results.getByText(/^No looks matched this request\./)).toBeVisible();
  await expect(results.getByRole('article')).toHaveCount(0);
});

test('without a saved design, the page links to Outfit Categories', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  await page.goto('/discover/looks');
  await expect(page.getByRole('heading', { name: 'Start with a design' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Outfit Categories' })).toHaveAttribute('href', '/categories');
  await expect(page.getByRole('button', { name: 'Show me looks' })).toHaveCount(0);
});

test('responsive: the request and the looks fit at 320, 390, 768 and 1366 px', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  const results = await looksForDesign(page, { occasion: 'Festive' });
  await expect(results.getByRole('article').first()).toBeVisible();

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
  const results = await looksForDesign(page, { occasion: 'Office' });
  await expect(results.getByRole('article')).not.toHaveCount(0);

  await test.step('change the profile in another tab', async () => {
    const profile = await context.newPage();
    await profile.goto('/profile');
    const basics = profile.locator('#basics');
    await basics.getByRole('radio', { name: 'Women’s Wear' }).check();
    await basics.getByText('Fabrics you like or avoid (optional)').click();
    await basics.locator('select[name="fabric_linen"]').selectOption('avoid');
    await basics.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(basics.getByText('Saved.')).toBeVisible();
    await profile.close();
  });

  await test.step('regenerate with the current profile', async () => {
    await results.getByRole('button', { name: 'Regenerate with my current profile' }).click();
    const regenerated = page.getByRole('region', { name: 'Regenerated looks' });
    await expect(regenerated.getByText('What changed')).toBeVisible();
    await expect(regenerated.getByText('You chose a department: Women.')).toBeVisible();
    await expect(regenerated.getByText('Your avoided fabrics now include linen.')).toBeVisible();
    await expect(regenerated.getByRole('article')).not.toHaveCount(0);
  });
});
