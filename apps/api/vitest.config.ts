import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // mongodb-memory-server downloads a MongoDB binary on first use.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
