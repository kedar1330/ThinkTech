import type { Page } from '@playwright/test';
import { expect } from './auth';

// Discover My Style builds its request from a design saved in Outfit Categories (D-132): the garment, its
// occasion tag (else Everyday) and its outfit category as the wear type. Every looks flow saves one first.

export interface DesignChoice {
  /** Garment type ID from the design catalogue. */
  garment?: string;
  /** Outfit category, which becomes the request's wear type. */
  outfit?: 'indian' | 'fusion' | 'western';
  /** Occasion tag name, e.g. `Office` (→ Work); none means Everyday. */
  occasion?: string;
}

/** Saves a design in the Outfit Categories customizer: the first neckline offered, plus an occasion tag. */
export async function saveDesign(
  page: Page,
  { garment = 'kurta', outfit = 'indian', occasion }: DesignChoice = {},
): Promise<void> {
  await page.goto(`/categories/design/${garment}?outfit=${outfit}`);
  // Feature cards are described by their reason; the like and hide buttons are not.
  const necklines = page.getByRole('region', { name: 'Necklines and collars' });
  await necklines.locator('button[aria-describedby]:enabled').first().click();
  if (occasion) {
    await page
      .getByRole('region', { name: 'Filter tags' })
      .getByRole('button', { name: new RegExp(`^${occasion}`) })
      .click();
  }
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByText('Your preferences are saved.')).toBeVisible();
}

/** Opens Discover My Style with the newest saved design and asks for looks. Returns the results region. */
export async function requestLooks(page: Page) {
  await page.goto('/discover/looks');
  await expect(page.getByRole('heading', { name: 'Find looks for your design' })).toBeVisible();
  await page.getByRole('button', { name: 'Show me looks' }).click();
  return page.getByRole('region', { name: 'Your looks' });
}

/** Saves a design and asks for looks around it. */
export async function looksForDesign(page: Page, design: DesignChoice = {}) {
  await saveDesign(page, design);
  return requestLooks(page);
}
