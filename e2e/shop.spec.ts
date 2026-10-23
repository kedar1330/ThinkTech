import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';
import { looksForDesign } from './fixtures/discover';

// Shop My Look, Stage 1 (#43): the user's own shortlist items on the parts of a saved look. Synthetic data
// only; the link uses an example domain and is never opened.

test('shop a saved look: add your own item to a part and see the labelled total', async ({ page }) => {
  await signUpAndSkipOnboarding(page);
  const results = await looksForDesign(page);
  const first = results.getByRole('article', { name: 'Look 1' });

  await test.step('save the look and open it in Shop My Look', async () => {
    await first.getByRole('button', { name: 'Save to Saved Outfits' }).click();
    await expect(first.getByRole('status')).toHaveText(/Saved to Saved Outfits\./);
    await first.getByRole('button', { name: 'Shop this look' }).click();
    await expect(page).toHaveURL(/\/shop\?outfitId=[a-f0-9]{24}$/);
    await expect(page.getByText('Product data unavailable')).toBeVisible();
    await expect(page.getByText(/Add items from your shortlist to the parts below/)).toBeVisible();
  });
  const shopUrl = page.url();

  await test.step('add an item you found to the shortlist', async () => {
    await page.goto('/shortlist');
    await page.getByLabel('Item name').fill('Synthetic test kurta');
    await page.getByLabel('Price you saw (₹)').fill('1299.50');
    await page.getByLabel('Link').fill('https://shop.example/kurta?ref=e2e');
    await page.getByRole('button', { name: 'Add to shortlist' }).click();
    await expect(page.getByText('“Synthetic test kurta” was added to your shortlist.')).toBeVisible();
  });

  await test.step('put it on the first part of the look', async () => {
    await page.goto(shopUrl);
    const part = page.getByRole('list', { name: 'Parts of this look' }).locator(':scope > li').first();
    await part.getByRole('combobox').selectOption({ label: 'Synthetic test kurta — ₹1,299.50' });
    await part.getByRole('button', { name: 'Add to look' }).click();
    await expect(part.getByText('Synthetic test kurta')).toBeVisible();
    await expect(part.getByText('Added by you — not verified by StyleMe')).toBeVisible();
    const link = part.getByRole('link', { name: /shop\.example/ });
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer nofollow');

    const summary = page.getByRole('group', { name: 'Price summary' });
    await expect(summary).toContainText('₹1,299.50');
    await expect(summary).toContainText('Total of prices you entered — not verified by StyleMe; not a checkout price');
    await expect(summary).toContainText(/1 of \d+ parts priced/);
  });

  await test.step('the saved look shows the same labelled total', async () => {
    await page.goto(`/saved/${new URL(shopUrl).searchParams.get('outfitId')}`);
    const summary = page.getByRole('group', { name: 'Price summary' });
    await expect(summary).toContainText('₹1,299.50');
    await expect(summary).toContainText('not a checkout price');
    await page.getByRole('link', { name: 'Shop this look' }).click();
    await expect(page).toHaveURL(shopUrl);
  });

  await test.step('take it off again; it stays in the shortlist', async () => {
    const part = page.getByRole('list', { name: 'Parts of this look' }).locator(':scope > li').first();
    await part.getByRole('button', { name: /^Take Synthetic test kurta off/ }).click();
    await expect(page.getByText(/Add items from your shortlist to the parts below/)).toBeVisible();
    await page.goto('/shortlist');
    await expect(page.getByRole('heading', { name: 'Synthetic test kurta' })).toBeVisible();
  });
});

test('Shop this look saves a Discover look as a Shop My Look tab; a suggested look opened directly asks to be saved', async ({
  page,
}) => {
  await signUpAndSkipOnboarding(page);
  const results = await looksForDesign(page);

  const unsavedId = await results
    .getByRole('article', { name: 'Look 1' })
    .locator('input[name="outfitId"]')
    .first()
    .inputValue();

  await test.step('Shop this look saves the look and opens it as a tab (#115)', async () => {
    await results.getByRole('article', { name: 'Look 2' }).getByRole('button', { name: 'Shop this look' }).click();
    await expect(page).toHaveURL(/\/shop\?outfitId=[a-f0-9]{24}$/);
    await expect(page.getByRole('list', { name: 'Parts of this look' })).toBeVisible();
    await expect(page.getByText(/Save this look first/)).toHaveCount(0);
  });

  await test.step('a suggested look opened by its link must be saved before items can be added', async () => {
    await page.goto(`/shop?outfitId=${unsavedId}`);
    await expect(page.getByText(/Save this look first/)).toBeVisible();
    await page.getByRole('button', { name: 'Save to Saved Outfits' }).click();
    await expect(page.getByRole('list', { name: 'Parts of this look' })).toBeVisible();
  });

  await test.step('the navigation entry opens the newest look, with one tab per saved Discover look (#115)', async () => {
    await page.goto('/shop');
    const tabs = page.getByRole('navigation', { name: 'Your looks from Discover My Style' });
    await expect(tabs.getByRole('listitem')).toHaveCount(2);
    await expect(tabs.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(page.getByText('Product data unavailable')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Parts of this look' })).toBeVisible();
  });

  await test.step('each tab’s Virtual Try-On button opens the honest Coming soon page', async () => {
    const tabs = page.getByRole('navigation', { name: 'Your looks from Discover My Style' });
    const tryOn = tabs.getByRole('link', { name: /^Virtual Try-On: .+ \(coming soon\)$/ });
    // One per tab: both saved looks have one.
    await expect(tryOn).toHaveCount(2);
    await tryOn.first().click();
    await expect(page).toHaveURL(/\/features\/virtual-try-on$/);
  });
});
