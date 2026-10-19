import { defineConfig } from '@playwright/test';
import { join } from 'node:path';
import { BASE_URL, REPO_ROOT } from './support/settings';

// Playwright E2E suite (TESTING.md §7, issue #36). `pnpm e2e` builds the apps, then global-setup.ts
// starts an in-memory MongoDB, the API (APP_ENV=local, dev outbox) and `next start`; every spec runs
// at a mobile and a desktop viewport. Set BASE_URL to run the same flows against a running deployment.

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: join(REPO_ROOT, 'test-results'),
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  // Every test registers its own user, so tests are independent and can run in parallel.
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [[CI ? 'github' : 'list'], ['html', { outputFolder: join(REPO_ROOT, 'playwright-report'), open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
