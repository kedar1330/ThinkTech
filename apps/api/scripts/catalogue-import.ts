// Loads the style-rules files into the shared catalogue collections in MongoDB (TD-FS-CAT-01, D-110).
// Safe to re-run: records are matched by ID and version.
//
//   pnpm --filter @styleme/api catalogue:import                    approved records only (published)
//   pnpm --filter @styleme/api catalogue:import --include-drafts   also store drafts, unpublished (local review)
//
// Output contains counts only.

import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { importStyleLibrary } from '../src/services/catalogue-import';
import { SHIPPED_LIBRARY } from '../src/style-rules';

async function main() {
  const config = loadConfig();
  const includeDrafts = process.argv.includes('--include-drafts');
  if (includeDrafts && config.APP_ENV === 'production') {
    throw new Error('--include-drafts is for local and staging review only');
  }
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const result = await importStyleLibrary(db.models, SHIPPED_LIBRARY, { includeDrafts });
    for (const [collection, counts] of Object.entries(result)) {
      process.stdout.write(`${collection}: ${JSON.stringify(counts)}\n`);
    }
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Catalogue import failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
