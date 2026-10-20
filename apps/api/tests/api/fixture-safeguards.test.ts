import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNotProduction, ProductionGuardError } from '../../scripts/lib/guard';
import { createLogger } from '../../src/logger';
import { startServer } from '../../src/server';
import {
  assertNoFixtureDocuments,
  findFixtureCollections,
  FixtureDocumentError,
} from '../../src/startup/fixture-check';
import { loadStyleLibrary } from '../../src/style-rules';
import { BASE_CONFIG, login, registerUser, startTestEnv, type TestEnv } from '../helpers';
import {
  makeFixture,
  makeFixtures,
  makeFixtureBetaInvite,
  makeFixtureOutfit,
  makeFixtureProfile,
  makeFixtureShortlistItem,
  makeFixtureUser,
  smallLibrary,
} from '../fixtures';

let env: TestEnv;

beforeAll(async () => {
  env = await startTestEnv();
});

afterAll(async () => {
  await env.stop();
});

beforeEach(async () => {
  await env.reset();
  vi.restoreAllMocks();
});

describe('script guard: assertNotProduction (issue #52, D-78, T-29)', () => {
  it('refuses execution when APP_ENV=production', () => {
    expect(() => assertNotProduction({ APP_ENV: 'production' })).toThrow(ProductionGuardError);
    expect(() => assertNotProduction('production')).toThrow(ProductionGuardError);
    expect(() => assertNotProduction({ APP_ENV: 'production' })).toThrow(/T-29/);
  });

  it('allows execution in local, staging, test and undefined environments', () => {
    expect(() => assertNotProduction({ APP_ENV: 'local' })).not.toThrow();
    expect(() => assertNotProduction({ APP_ENV: 'staging' })).not.toThrow();
    expect(() => assertNotProduction({ APP_ENV: 'test' })).not.toThrow();
    expect(() => assertNotProduction({})).not.toThrow();
    expect(() => assertNotProduction('local')).not.toThrow();
  });

  it('supports custom error message', () => {
    expect(() => assertNotProduction({ APP_ENV: 'production' }, 'Custom guard message')).toThrow(
      'Custom guard message',
    );
  });

  it('seed.ts imports and calls assertNotProduction', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const seedContent = fs.readFileSync(path.resolve(__dirname, '../../scripts/seed.ts'), 'utf8');
    expect(seedContent).toContain("import { assertNotProduction } from './lib/guard';");
    expect(seedContent).toContain('assertNotProduction(config);');
  });
});

describe('fixture helpers (issue #52, D-78)', () => {
  it('makeFixture marks single objects with isFixture: true', () => {
    const raw = { name: 'Test' };
    const fixture = makeFixture(raw);
    expect(fixture).toEqual({ name: 'Test', isFixture: true });
    expect(fixture.isFixture).toBe(true);
  });

  it('makeFixtures marks array of objects with isFixture: true', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const fixtures = makeFixtures(items);
    expect(fixtures).toEqual([
      { id: 1, isFixture: true },
      { id: 2, isFixture: true },
    ]);
  });

  it('domain fixture helpers produce isFixture: true objects', () => {
    const user = makeFixtureUser();
    expect(user.isFixture).toBe(true);
    expect(user.email).toMatch(/^fixture-/);

    const profile = makeFixtureProfile('u-1');
    expect(profile.isFixture).toBe(true);
    expect(profile.userId).toBe('u-1');

    const outfit = makeFixtureOutfit('u-1');
    expect(outfit.isFixture).toBe(true);

    const item = makeFixtureShortlistItem('u-1');
    expect(item.isFixture).toBe(true);

    const invite = makeFixtureBetaInvite('fixture@example.com');
    expect(invite.isFixture).toBe(true);
  });

  it('Mongoose models preserve isFixture: true when saving fixture documents', async () => {
    const user = await env.db.models.User.create(
      makeFixtureUser({
        email: 'mongoose-fixture@example.com',
        name: 'Mongoose Fixture User',
      }),
    );
    expect((user as unknown as { isFixture?: boolean }).isFixture).toBe(true);

    const found = await env.db.models.User.findOne({ email: 'mongoose-fixture@example.com' }).lean();
    expect((found as unknown as { isFixture?: boolean })?.isFixture).toBe(true);
  });
});

describe('startup check: assertNoFixtureDocuments (issue #52, D-78, T-30, AC-15)', () => {
  it('allows startup when APP_ENV is not production even with fixture documents', async () => {
    await env.db.main.collection('users').insertOne({ email: 'fixture@example.com', isFixture: true });

    await expect(assertNoFixtureDocuments(env.db, { APP_ENV: 'local' })).resolves.toBeUndefined();
    await expect(assertNoFixtureDocuments(env.db, { APP_ENV: 'staging' })).resolves.toBeUndefined();
    await expect(assertNoFixtureDocuments(env.db, { APP_ENV: 'test' })).resolves.toBeUndefined();
  });

  it('allows startup in production when database has no fixtures', async () => {
    await env.db.main.collection('users').insertOne({ email: 'real@example.com', isFixture: false });
    await env.db.main.collection('outfits').insertOne({ title: 'Real look' });

    await expect(assertNoFixtureDocuments(env.db, { APP_ENV: 'production' })).resolves.toBeUndefined();
  });

  it('refuses startup in production when fixture documents exist and logs collection names only', async () => {
    const SECRET_DATA = 'SECRET_PASSWORD_OR_PII_NEVER_LOG';
    await env.db.main.collection('users').insertOne({
      email: 'fixture-user@example.com',
      secretNote: SECRET_DATA,
      isFixture: true,
    });
    await env.db.main.collection('outfits').insertOne({
      title: 'Secret outfit',
      secretInfo: SECRET_DATA,
      isFixture: true,
    });

    const logLines: string[] = [];
    const logger = createLogger({ write: (line: string) => void logLines.push(line) });

    await expect(assertNoFixtureDocuments(env.db, { APP_ENV: 'production' }, logger)).rejects.toThrow(
      FixtureDocumentError,
    );

    // Verify error message names collection names only
    try {
      await assertNoFixtureDocuments(env.db, { APP_ENV: 'production' }, logger);
      expect.fail('Should have thrown FixtureDocumentError');
    } catch (err) {
      expect(err).toBeInstanceOf(FixtureDocumentError);
      const fixtureErr = err as FixtureDocumentError;
      expect(fixtureErr.collections).toEqual(['outfits', 'users']);
      expect(fixtureErr.message).toContain('outfits');
      expect(fixtureErr.message).toContain('users');
      expect(fixtureErr.message).not.toContain(SECRET_DATA);
      expect(fixtureErr.message).not.toContain('fixture-user@example.com');
    }

    // Verify log lines contain collection names only, never document data
    const logs = logLines.join('\n');
    expect(logs).toContain('fixture_documents_in_production');
    expect(logs).toContain('users');
    expect(logs).toContain('outfits');
    expect(logs).not.toContain(SECRET_DATA);
    expect(logs).not.toContain('fixture-user@example.com');
  });

  it('findFixtureCollections inspects both main db and tombstone store', async () => {
    await env.db.tombstones.collection('deletionTombstones').insertOne({
      emailHmac: 'hmac123',
      isFixture: true,
    });

    const collections = await findFixtureCollections(env.db);
    expect(collections).toContain('deletionTombstones');
  });
});

describe('T-30 API startup integration test (issue #52, D-78, AC-15)', () => {
  it('T-30: boots with APP_ENV=production and a fixture document and expects startup to fail', async () => {
    const SECRET_FIXTURE_BODY = 'TOP_SECRET_FIXTURE_PAYLOAD';
    // Insert a fixture document directly into the database
    await env.db.main.collection('shortlistItems').insertOne({
      name: 'Fixture Item',
      payload: SECRET_FIXTURE_BODY,
      isFixture: true,
    });

    const logLines: string[] = [];
    const logger = createLogger({ write: (line: string) => void logLines.push(line) });

    // Expect server startup to fail
    await expect(
      startServer({
        config: {
          ...BASE_CONFIG,
          APP_ENV: 'production',
          SMTP_URL: 'smtp://127.0.0.1:25',
          EMAIL_FROM: 'no-reply@example.com',
          MONGODB_URI: env.mongo.getUri('styleme'),
          TOMBSTONE_STORE_URI: env.mongo.getUri('styleme_tombstones'),
        },
        db: env.db,
        logger,
        listen: false,
      }),
    ).rejects.toThrow(FixtureDocumentError);

    const logs = logLines.join('\n');
    expect(logs).toContain('shortlistItems');
    expect(logs).not.toContain(SECRET_FIXTURE_BODY);
  });

  it('boots successfully with APP_ENV=production when no fixtures exist', async () => {
    const started = await startServer({
      config: {
        ...BASE_CONFIG,
        APP_ENV: 'production',
        SMTP_URL: 'smtp://127.0.0.1:25',
        EMAIL_FROM: 'no-reply@example.com',
        MONGODB_URI: env.mongo.getUri('styleme'),
        TOMBSTONE_STORE_URI: env.mongo.getUri('styleme_tombstones'),
      },
      db: env.db,
      listen: false,
    });

    expect(started.app).toBeDefined();
    expect(started.config.APP_ENV).toBe('production');
  });
});

describe('endpoint safety in production configuration (AC-15, T-29)', () => {
  it('T-29: style library loader refuses fixture libraries when APP_ENV=production', () => {
    expect(() => loadStyleLibrary(smallLibrary(), { allowFixtures: true, appEnv: 'production' })).toThrow(/T-29/);
  });

  it('catalogue import rejects fixture libraries in production configuration (T-29)', async () => {
    const { importStyleLibrary } = await import('../../src/services/catalogue-import');
    await expect(
      importStyleLibrary(env.db.models, smallLibrary(), { allowFixtures: true, appEnv: 'production' }),
    ).rejects.toThrow(/Fixture style libraries are never imported in production/);
  });

  it('no endpoint returns a fixture in production configuration', async () => {
    const { app, mail } = env.makeApp({
      APP_ENV: 'production',
      SMTP_URL: 'smtp://127.0.0.1:25',
      EMAIL_FROM: 'no-reply@example.com',
    });

    // Public health endpoint
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.isFixture).toBeUndefined();

    // User registration & login with clean production data
    const email = 'prod-user@example.com';
    const user = await registerUser(app, env, mail, email);
    expect(user.id).toBeDefined();
    const token = await login(app, email);

    // Style palettes endpoint
    const palettes = await request(app).get('/v1/style/palettes?view=all').set('Authorization', `Bearer ${token}`);
    expect(palettes.status).toBe(200);
    for (const p of palettes.body.data.palettes) {
      expect(p.isFixture).toBeUndefined();
    }

    // Outfits endpoint
    const outfits = await request(app).get('/v1/outfits').set('Authorization', `Bearer ${token}`);
    expect(outfits.status).toBe(200);
    for (const o of outfits.body.data.looks) {
      expect(o.isFixture).toBeUndefined();
    }

    // Shortlist endpoint
    const shortlist = await request(app).get('/v1/shortlist').set('Authorization', `Bearer ${token}`);
    expect(shortlist.status).toBe(200);
    for (const item of shortlist.body.data.items) {
      expect(item.isFixture).toBeUndefined();
    }
  });
});
