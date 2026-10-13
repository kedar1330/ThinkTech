// Seeds the admin account (D-95). Registration never creates admins; this is the only way to create one
// besides `pnpm admin set-role`. Credentials come from the environment, never from source code:
//
//   SEED_ADMIN_EMAIL=admin@example.com
//   SEED_ADMIN_PASSWORD=<meets the password policy>
//   SEED_ADMIN_NAME="StyleMe Admin"        (optional)
//
//   pnpm seed                    create the admin if it doesn't exist (safe to re-run)
//   pnpm seed --reset-password   also replace an existing admin's password and end its sessions
//
// The admin is created verified and skips onboarding, so it logs in directly at /login. It contains no
// fixture data, so unlike fixture seeds it may run in every environment. Remove SEED_ADMIN_PASSWORD
// from the environment after seeding. The password is never printed or logged.

import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { createLogger } from '../src/logger';
import { adminSeedFromEnv, seedAdmin } from '../src/services/admin-seed';

const MESSAGES = {
  created: 'Admin account created. Log in at /login with the seeded email and password.\n',
  password_reset: 'Admin password replaced; all of its sessions were ended.\n',
  unchanged: 'Admin account already exists; nothing changed (use --reset-password to replace the password).\n',
} as const;

async function main() {
  const config = loadConfig();
  const input = adminSeedFromEnv();
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const result = await seedAdmin(db.models, config.AUTH_ACCESS_TOKEN_SECRET, input, {
      resetPassword: process.argv.includes('--reset-password'),
      logger: createLogger(),
    });
    process.stdout.write(MESSAGES[result]);
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
