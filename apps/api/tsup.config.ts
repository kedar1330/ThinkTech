import { defineConfig } from 'tsup';

// Bundles the API and its operator scripts. @styleme/contracts is TypeScript source, so it is bundled in.
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    admin: 'scripts/admin.ts',
    'reconcile-tombstones': 'scripts/reconcile-tombstones.ts',
  },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  clean: true,
  noExternal: ['@styleme/contracts'],
});
