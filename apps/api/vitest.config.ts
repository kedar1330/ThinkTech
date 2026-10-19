import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // mongodb-memory-server downloads a MongoDB binary on first use.
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // `pnpm test:coverage` only. D-70: no global gate; ≥ 80 % line coverage for the generator, the
    // rule loader and the budget engine (#37).
    coverage: {
      provider: 'v8',
      include: [
        'src/services/engine/**/*.ts',
        'src/style-rules/loader.ts',
        'src/style-rules/linter.ts',
        'src/services/budget.ts',
      ],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 80, perFile: true },
    },
  },
});
