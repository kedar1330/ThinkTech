import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOCAL_MONGO_DBPATH, localMongoDbPath } from '../../scripts/lib/local-mongo-path';

// The local development database keeps its data in a fixed folder (#140), never a temporary one.

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('localMongoDbPath', () => {
  it('defaults to apps/api/.mongo-data', () => {
    expect(DEFAULT_LOCAL_MONGO_DBPATH).toBe(resolve(__dirname, '../../.mongo-data'));
    expect(localMongoDbPath({})).toBe(DEFAULT_LOCAL_MONGO_DBPATH);
  });

  it('uses LOCAL_MONGO_DBPATH and creates the folder', () => {
    const base = mkdtempSync(join(tmpdir(), 'styleme-db-'));
    made.push(base);
    const target = join(base, 'nested', 'data');
    expect(localMongoDbPath({ LOCAL_MONGO_DBPATH: ` ${target} ` })).toBe(target);
    expect(existsSync(target)).toBe(true);
  });

  it('takes a relative override from apps/api', () => {
    const dir = localMongoDbPath({ LOCAL_MONGO_DBPATH: '.mongo-data-test-140' });
    made.push(dir);
    expect(dir).toBe(resolve(__dirname, '../../.mongo-data-test-140'));
  });
});
