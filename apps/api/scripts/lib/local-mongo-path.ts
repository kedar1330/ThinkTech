import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Where the local development database keeps its data (#140). It used to live in a temporary folder that
// mongodb-memory-server deletes on stop, so every account was lost on restart. The default is
// `apps/api/.mongo-data/` (git-ignored); `LOCAL_MONGO_DBPATH` points it elsewhere.

const API_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_LOCAL_MONGO_DBPATH = resolve(API_DIR, '.mongo-data');

/** The data folder to use, created if it doesn't exist. A relative override is taken from `apps/api/`. */
export function localMongoDbPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.LOCAL_MONGO_DBPATH?.trim();
  const dbPath = override ? (isAbsolute(override) ? override : resolve(API_DIR, override)) : DEFAULT_LOCAL_MONGO_DBPATH;
  mkdirSync(dbPath, { recursive: true });
  return dbPath;
}
