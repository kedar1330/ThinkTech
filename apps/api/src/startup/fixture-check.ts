import type { Connection } from 'mongoose';
import type { Database } from '../db';
import type { Logger } from 'pino';

/**
 * Thrown when fixture documents (`isFixture: true`) are detected in production (issue #52, D-78, T-30).
 * Exposes only collection names (never document data) to protect user and system data integrity.
 */
export class FixtureDocumentError extends Error {
  readonly collections: readonly string[];

  constructor(collections: readonly string[]) {
    super(`Fixture documents found in production in collection(s): ${collections.join(', ')} (T-30)`);
    this.name = 'FixtureDocumentError';
    this.collections = collections;
  }
}

/**
 * Scans every collection across the main database, tombstone store, and registered models
 * for documents marked `isFixture: true`.
 * Returns sorted unique collection names containing fixture documents.
 */
export async function findFixtureCollections(db: Database): Promise<string[]> {
  const seen = new Set<string>();
  const found: string[] = [];

  const connections: Connection[] = [db.main, db.tombstones].filter(Boolean);
  for (const conn of connections) {
    if (!conn.db) continue;
    const collections = await conn.db.collections();
    for (const col of collections) {
      if (seen.has(col.collectionName)) continue;
      seen.add(col.collectionName);
      const count = await col.countDocuments({ isFixture: true }, { limit: 1 });
      if (count > 0) {
        found.push(col.collectionName);
      }
    }
  }

  // Also verify any registered models that may correspond to collections not yet instantiated
  if (db.models) {
    for (const model of Object.values(db.models)) {
      const name = model?.collection?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const count = await model.countDocuments({ isFixture: true }).limit(1);
      if (count > 0) {
        found.push(name);
      }
    }
  }

  found.sort();
  return found;
}

/**
 * Startup safeguard (issue #52, D-78, T-30, AC-15).
 * Refuses startup when `APP_ENV=production` and any document has `isFixture: true`.
 * Logs collection names only (never document data) and throws FixtureDocumentError.
 */
export async function assertNoFixtureDocuments(
  db: Database,
  config: { APP_ENV: string },
  logger?: Logger,
): Promise<void> {
  if (config.APP_ENV !== 'production') {
    return;
  }

  const collections = await findFixtureCollections(db);
  if (collections.length > 0) {
    logger?.fatal({
      event: 'fixture_documents_in_production',
      collections,
    });
    throw new FixtureDocumentError(collections);
  }
}
