import { expect, signUpAndSkipOnboarding, test } from './fixtures/auth';
import { looksForDesign } from './fixtures/discover';

// Palette and Saved Outfits flow (#39 – #42, issue #51):
// browse palettes → request looks → save → feedback → remove, at mobile and desktop viewports,
// plus responsive checks across all required widths (320, 390, 768, 1366 px).

test('journey: browse palettes → request looks → save → feedback → remove', async ({ page }) => {
  await signUpAndSkipOnboarding(page);

  await test.step('browse palettes: list and details', async () => {
    await page.goto('/palette');
    await expect(page.getByRole('heading', { name: 'Curated colour palettes' })).toBeVisible();
    const palettes = page.getByRole('region', { name: 'Curated palettes' }).getByRole('article');
    await expect(palettes.first()).toBeVisible();
    const firstPaletteLink = palettes.first().getByRole('heading', { level: 2 }).getByRole('link');
    const paletteName = await firstPaletteLink.textContent();
    await firstPaletteLink.click();
    await expect(page).toHaveURL(/\/palette\/[a-zA-Z0-9_-]+$/);
    await expect(page.getByRole('heading', { level: 1, name: paletteName! })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Palette colours' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Coordinating colours' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Curated combinations' })).toBeVisible();
  });

  const firstLook = await test.step('save a design and request looks', async () => {
    const region = await looksForDesign(page);
    await expect(region).toBeVisible();
    const look = region.getByRole('article', { name: 'Look 1' });
    await expect(look).toBeVisible();
    return look;
  });

  await test.step('save the look to Saved Outfits', async () => {
    await firstLook.getByRole('button', { name: 'Save to Saved Outfits' }).click();
    await expect(firstLook.getByRole('status')).toHaveText(/Saved to Saved Outfits\./);
    await firstLook.getByRole('link', { name: 'View in Saved Outfits' }).click();
    await expect(page).toHaveURL(/\/saved\/[a-f0-9]{24}$/);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  });

  await test.step('record feedback on the look', async () => {
    // 1. Give love_it feedback
    const loveBtn = page.getByRole('button', { name: 'Love this look' });
    await loveBtn.click();
    await expect(loveBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(loveBtn).toHaveText(/Loved/);
    await expect(page.getByRole('status')).toContainText('Feedback saved');

    // 2. Change feedback to not_for_me with a specific reason
    const notForMeBtn = page.getByRole('button', { name: 'Not for me', exact: true });
    await notForMeBtn.click();
    await expect(notForMeBtn).toHaveAttribute('aria-pressed', 'true');
    const reasons = page.getByRole('group', { name: 'Select a reason' });
    await expect(reasons).toBeVisible();
    const colourReason = reasons.getByRole('button', { name: 'Colours not for me' });
    await colourReason.click();
    await expect(colourReason).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status')).toContainText('Feedback saved');
  });

  await test.step('remove the look from Saved Outfits', async () => {
    await page.getByRole('button', { name: /^Remove / }).click();
    await expect(page.getByRole('heading', { name: 'Remove this look?' })).toBeVisible();
    await page.getByRole('button', { name: 'Remove look' }).click();
    await expect(page).toHaveURL(/\/saved$/);
    await expect(page.getByRole('heading', { name: 'No saved looks yet' })).toBeVisible();
  });
});

test('responsive: palettes and saved outfits fit at 320, 390, 768 and 1366 px', async ({ page }) => {
  await signUpAndSkipOnboarding(page);

  // 1. Check /palette
  await page.goto('/palette');
  await expect(page.getByRole('heading', { name: 'Curated colour palettes' })).toBeVisible();
  for (const width of [320, 390, 768, 1366]) {
    await test.step(`palettes list at ${width} px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width} px on /palette`).toBeLessThanOrEqual(0);
    });
  }

  // 2. Check /palette/[id]
  const palettes = page.getByRole('region', { name: 'Curated palettes' }).getByRole('article');
  await palettes.first().getByRole('heading', { level: 2 }).getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Palette colours' })).toBeVisible();
  for (const width of [320, 390, 768, 1366]) {
    await test.step(`palette detail at ${width} px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width} px on /palette/[id]`).toBeLessThanOrEqual(0);
    });
  }

  // 3. Request and save a look to check /saved and /saved/[id]
  const firstLook = (await looksForDesign(page)).getByRole('article', { name: 'Look 1' });
  await firstLook.getByRole('button', { name: 'Save to Saved Outfits' }).click();
  await expect(firstLook.getByRole('status')).toHaveText(/Saved to Saved Outfits\./);
  await firstLook.getByRole('link', { name: 'View in Saved Outfits' }).click();
  await expect(page).toHaveURL(/\/saved\/[a-f0-9]{24}$/);

  // 4. Check /saved/[id]
  for (const width of [320, 390, 768, 1366]) {
    await test.step(`saved look detail at ${width} px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width} px on /saved/[id]`).toBeLessThanOrEqual(0);
    });
  }

  // 5. Check /saved list
  await page.goto('/saved');
  await expect(page.getByRole('heading', { name: 'Your saved looks' })).toBeVisible();
  for (const width of [320, 390, 768, 1366]) {
    await test.step(`saved looks list at ${width} px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `horizontal overflow at ${width} px on /saved`).toBeLessThanOrEqual(0);
    });
  }
});
