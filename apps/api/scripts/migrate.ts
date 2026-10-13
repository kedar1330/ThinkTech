// Applies pending database migrations (DEPLOYMENT.md §6). Run before a new API version takes traffic:
//
//   pnpm --filter @styleme/api migrate
//
// Output contains counts only, never personal data.

import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { runMigrations } from './migrations/index';

async function main() {
  const config = loadConfig();
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const applied = await runMigrations(db.main, (line) => process.stdout.write(`${line}\n`));
    process.stdout.write(applied.length ? `Applied ${applied.length} migration(s).\n` : 'No pending migrations.\n');
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Migration failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
