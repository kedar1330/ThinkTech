// My Profile illustrations (D-129): measuring guides and undertone hands, generated in code.
//
//   pnpm --filter @styleme/api illustrations:generate   write the SVG files to apps/web/public/illustrations/profile/
//   pnpm --filter @styleme/api illustrations:seed       record them in the `illustrations` collection (needs apps/api/.env)
//
// Output contains counts only.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { profileIllustrations, seedProfileIllustrations } from '../src/services/profile-illustrations';

const WEB_PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/public');

async function generate() {
  const records = profileIllustrations();
  for (const r of records) {
    const file = join(WEB_PUBLIC, r.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, r.svg, 'utf8');
  }
  process.stdout.write(`illustrations written: ${records.length}\n`);
}

async function seed() {
  const config = loadConfig();
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const result = await seedProfileIllustrations(db.models);
    process.stdout.write(`illustrations recorded: ${result.upserted}\n`);
  } finally {
    await db.close();
  }
}

const command = process.argv[2];
(command === 'seed' ? seed() : generate()).catch((err: unknown) => {
  process.stderr.write(`Profile illustrations failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
