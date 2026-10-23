import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../scripts/migrations/index';
import { startTestEnv, type TestEnv } from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});

describe('migration 001-auth-onboarding', () => {
  it('upgrades accounts created before verification and onboarding existed; runs once', async () => {
    const users = env.db.main.collection('users');
    const createdAt = new Date('2026-10-10T10:00:00Z');
    const { insertedId: withProfile } = await users.insertOne({
      email: 'legacy@example.com',
      passwordHash: '$argon2id$legacy',
      name: 'Legacy',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
      createdAt,
      updatedAt: createdAt,
    });
    const { insertedId: bare } = await users.insertOne({
      email: 'bare@example.com',
      passwordHash: '$argon2id$legacy',
      name: 'Bare',
      role: 'user',
      isActive: true,
      tokenVersion: 0,
      createdAt,
      updatedAt: createdAt,
    });
    await env.db.main
      .collection('profiles')
      .insertOne({ userId: withProfile, department: 'women', updatedAt: createdAt });
    await env.db.main.collection('passwordResetTokens').insertOne({ userId: bare, tokenHash: 'x' });

    expect(await runMigrations(env.db.main)).toEqual([
      '001-auth-onboarding',
      '002-user-photos-in-mongodb',
      '003-outfit-source',
    ]);
    const a = await users.findOne({ _id: withProfile });
    const b = await users.findOne({ _id: bare });
    expect(a?.emailVerifiedAt).toEqual(createdAt);
    expect(a?.onboarding).toEqual({ styleProfileCompletedAt: createdAt, appearanceCompletedAt: null });
    expect(b?.onboarding).toEqual({ styleProfileCompletedAt: null, appearanceCompletedAt: null });
    expect(b?.loginSecurity).toEqual({ failedCount: 0, lockedUntil: null });
    expect(b?.consent).toMatchObject({ termsAcceptedAt: null, marketingOptIn: false });
    expect(await env.db.main.collection('passwordResetTokens').countDocuments()).toBe(0);

    // Recorded; a second run applies nothing.
    expect(await runMigrations(env.db.main)).toEqual([]);
  });
});

describe('migration 002-user-photos-in-mongodb (D-129)', () => {
  it('drops the old unique storageKey_1 index so photos without a key can be stored', async () => {
    const photos = env.db.main.collection('userPhotos');
    await photos.createIndex({ storageKey: 1 }, { unique: true, name: 'storageKey_1' });
    // 001 and 002 already ran in the test above; run 002 again against the old index.
    await env.db.main.collection('migrations').deleteOne({ _id: '002-user-photos-in-mongodb' as never });
    expect(await runMigrations(env.db.main)).toEqual(['002-user-photos-in-mongodb']);
    const names = (await photos.indexes()).map((i) => i.name);
    expect(names).not.toContain('storageKey_1');
    expect(names).toContain('storageKey_when_set');
    await photos.insertMany([{ kind: 'face' }, { kind: 'face' }]);
    expect(await runMigrations(env.db.main)).toEqual([]);
  });
});

describe('migration 003-outfit-source (#115)', () => {
  it('marks looks made before the source existed as Discover My Style; runs once', async () => {
    const outfits = env.db.main.collection('outfits');
    const { insertedId: legacy } = await outfits.insertOne({ status: 'saved', templateId: 'OUT-001' });
    const { insertedId: current } = await outfits.insertOne({ status: 'saved', source: 'discover_my_style' });
    // 001 – 003 already ran above; run 003 again against the legacy look.
    await env.db.main.collection('migrations').deleteOne({ _id: '003-outfit-source' as never });
    expect(await runMigrations(env.db.main)).toEqual(['003-outfit-source']);
    expect((await outfits.findOne({ _id: legacy }))?.source).toBe('discover_my_style');
    expect((await outfits.findOne({ _id: current }))?.source).toBe('discover_my_style');
    expect((await env.db.main.collection('migrations').findOne({ _id: '003-outfit-source' as never }))?.result).toEqual(
      { looksMarkedDiscoverMyStyle: 1 },
    );
    expect(await runMigrations(env.db.main)).toEqual([]);
  });
});
