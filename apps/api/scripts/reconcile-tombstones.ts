// Replays deletion tombstones and verifies the result (DEPLOYMENT.md §6, D-85).
//
//   pnpm reconcile                         against the live database (MONGODB_URI) — completes any
//                                          account deletion that failed partway
//   pnpm reconcile --target <mongodb-uri>  against an isolated restored database (restore step 5–6)
//
// Exit code 0 only when verification passes. The report contains counts only, no personal data.

import mongoose from 'mongoose';
import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { replayTombstones } from '../src/services/account-deletion';

async function main() {
  const config = loadConfig();
  const args = process.argv.slice(2);
  const i = args.indexOf('--target');
  const targetUri = i >= 0 ? args[i + 1] : undefined;
  if (i >= 0 && !targetUri) throw new Error('--target needs a MongoDB URI');

  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  const target = targetUri ? await mongoose.createConnection(targetUri).asPromise() : db.main;
  try {
    const report = await replayTombstones(db.models, target, config.TOMBSTONE_HMAC_KEY);
    process.stdout.write(
      `${JSON.stringify({ ...report, target: targetUri ? 'restored' : 'live', at: new Date().toISOString() }, null, 2)}\n`,
    );
    if (!report.ok) process.exitCode = 1;
  } finally {
    if (targetUri) await target.close();
    await db.close();
  }
}

main().catch((err: unknown) => {
  // Stop on any failure: the restored database must not be served (DEPLOYMENT.md §6).
  process.stderr.write(`Reconciliation failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
