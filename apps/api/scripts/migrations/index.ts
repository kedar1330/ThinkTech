import type { Connection } from 'mongoose';

// Versioned, backward-compatible migrations (D-79, DATABASE.md §10). Each runs once, in order, and is
// recorded in the `migrations` collection. Every migration must be idempotent and must keep the
// previous API version working (add first, remove later).

export interface Migration {
  id: string;
  description: string;
  up(db: Connection): Promise<Record<string, number>>;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001-auth-onboarding',
    description:
      'Accounts created before email verification existed are marked verified (they registered by invitation); ' +
      'add login-lockout, consent and onboarding fields; derive onboarding progress from existing profiles; ' +
      'remove legacy password-reset tokens (superseded by authChallenges).',
    async up(db) {
      const users = db.collection('users');
      const verified = await users.updateMany({ emailVerifiedAt: { $exists: false } }, [
        { $set: { emailVerifiedAt: '$createdAt' } },
      ]);
      const defaults = await users.updateMany(
        { loginSecurity: { $exists: false } },
        {
          $set: {
            loginSecurity: { failedCount: 0, lockedUntil: null },
            city: null,
            phone: null,
            consent: {
              termsVersion: null,
              termsAcceptedAt: null,
              privacyVersion: null,
              privacyAcceptedAt: null,
              marketingOptIn: false,
              marketingUpdatedAt: null,
            },
            onboarding: { styleProfileCompletedAt: null, appearanceCompletedAt: null },
          },
        },
      );

      let onboarding = 0;
      for await (const profile of db.collection('profiles').find({}, { projection: { userId: 1, updatedAt: 1 } })) {
        const r = await users.updateOne(
          { _id: profile.userId, 'onboarding.styleProfileCompletedAt': null },
          { $set: { 'onboarding.styleProfileCompletedAt': profile.updatedAt ?? new Date() } },
        );
        onboarding += r.modifiedCount;
      }
      for await (const signals of db
        .collection('appearanceProfiles')
        .find({}, { projection: { userId: 1, updatedAt: 1 } })) {
        await users.updateOne(
          { _id: signals.userId, 'onboarding.appearanceCompletedAt': null },
          { $set: { 'onboarding.appearanceCompletedAt': signals.updatedAt ?? new Date() } },
        );
      }
      const legacyTokens = await db.collection('passwordResetTokens').deleteMany({});
      return {
        usersMarkedVerified: verified.modifiedCount,
        usersWithNewFields: defaults.modifiedCount,
        styleProfilesMarkedComplete: onboarding,
        legacyResetTokensRemoved: legacyTokens.deletedCount,
      };
    },
  },
  {
    id: '002-user-photos-in-mongodb',
    description:
      'Photos are stored in userPhotos itself since D-129, without a storageKey: drop the old unique ' +
      'storageKey_1 index (it would treat every missing key as a duplicate). The partial index ' +
      'storageKey_when_set replaces it.',
    async up(db) {
      const photos = db.collection('userPhotos');
      const indexes = await photos.indexes().catch(() => []);
      const old = indexes.some((i) => i.name === 'storageKey_1');
      if (old) await photos.dropIndex('storageKey_1');
      return { oldStorageKeyIndexDropped: old ? 1 : 0 };
    },
  },
  {
    id: '003-outfit-source',
    description:
      'Looks record the feature they were created in (#115). Every look made so far came from ' +
      'POST /v1/recommendations, the Discover My Style engine, so looks without a source get discover_my_style.',
    async up(db) {
      const backfilled = await db
        .collection('outfits')
        .updateMany({ source: { $exists: false } }, { $set: { source: 'discover_my_style' } });
      return { looksMarkedDiscoverMyStyle: backfilled.modifiedCount };
    },
  },
];

/** Applies pending migrations in order. Returns the IDs applied in this run. */
export async function runMigrations(db: Connection, log: (line: string) => void = () => undefined): Promise<string[]> {
  const registry = db.collection<{ _id: string; appliedAt: Date; result: Record<string, number> }>('migrations');
  const applied: string[] = [];
  for (const migration of MIGRATIONS) {
    if (await registry.findOne({ _id: migration.id })) continue;
    const result = await migration.up(db);
    await registry.insertOne({ _id: migration.id, appliedAt: new Date(), result });
    log(`${migration.id}: ${JSON.stringify(result)}`);
    applied.push(migration.id);
  }
  return applied;
}
