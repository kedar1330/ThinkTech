import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';
import { looksForDesign } from './fixtures/discover';

// Saving a look from the Discover results (FR-OUT-01, #47) and finding it in Saved Outfits (#41).

test('save a look from the results, then open it in Saved Outfits', async ({ page }) => {
  await signUpAndSkipOnboarding(page);

  const first = await test.step('get looks for a saved design', async () => {
    const look = (await looksForDesign(page)).getByRole('article', { name: 'Look 1' });
    await expect(look).toBeVisible();
    return look;
  });

  await test.step('save it', async () => {
    await first.getByRole('button', { name: 'Save to Saved Outfits' }).click();
    await expect(first.getByRole('status')).toHaveText(/Saved to Saved Outfits\./);
  });

  await test.step('open it from the confirmation', async () => {
    await first.getByRole('link', { name: 'View in Saved Outfits' }).click();
    await expect(page).toHaveURL(/\/saved\/[a-f0-9]{24}$/);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByText(/isn’t saved yet/)).toHaveCount(0);
  });

  await test.step('it is listed in Saved Outfits', async () => {
    await page.goto('/saved');
    await expect(page.getByRole('heading', { name: 'Your saved looks' })).toBeVisible();
    await expect(page.getByText('1 saved look')).toBeVisible();
  });
});
