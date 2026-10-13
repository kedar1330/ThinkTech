import { Types, type Connection } from 'mongoose';
import { TOMBSTONE_RETENTION_MS } from '../config/env';
import { USER_OWNED_COLLECTIONS, type Models } from '../models/index';
import { hmacSha256, normaliseEmail } from '../utils/crypto';
import { AppError } from '../utils/errors';

// Account deletion with tombstones, and tombstone replay (DATABASE.md §3.1c, DEPLOYMENT.md §6, D-85).
// Replay uses raw collections, so it works against any database — the live one (reconciliation) or
// an isolated restored copy (restore procedure).

export type DeletionSource = 'self_service' | 'admin_request';

/** Deletes one account's data from `db`. Idempotent. Sessions go first, `users` last. */
export async function deleteUserData(db: Connection, userId: Types.ObjectId, email?: string): Promise<void> {
  for (const name of USER_OWNED_COLLECTIONS) {
    await db.collection(name).deleteMany({ userId });
  }
  if (email) await db.collection('betaInvites').deleteMany({ email: normaliseEmail(email) });
  // A pending registration reserves the future user's _id; clear any leftover one too.
  await db.collection('pendingRegistrations').deleteMany({ _id: userId });
  if (email) await db.collection('pendingRegistrations').deleteMany({ email: normaliseEmail(email) });
  await db.collection('users').deleteOne({ _id: userId });
}

/**
 * Deletes an account: (1) tombstone first — if that fails, nothing is deleted and the caller gets
 * SERVICE_UNAVAILABLE; (2) all data from the live database. If step 2 fails partway, the tombstone
 * remains and reconciliation completes the deletion.
 */
export async function deleteAccount(
  models: Models,
  main: Connection,
  hmacKey: string,
  user: { _id: Types.ObjectId; email: string },
  source: DeletionSource,
): Promise<void> {
  const deletedAt = new Date();
  try {
    await models.Tombstone.create({
      userId: user._id,
      emailHmac: hmacSha256(hmacKey, normaliseEmail(user.email)),
      deletedAt,
      source,
      expiresAt: new Date(deletedAt.getTime() + TOMBSTONE_RETENTION_MS),
    });
  } catch {
    throw new AppError('SERVICE_UNAVAILABLE');
  }
  await deleteUserData(main, user._id, user.email);
}

export interface ReplayReport {
  tombstonesRead: number;
  tombstonesProcessed: number;
  invitesDeleted: number;
  remainingDocuments: Record<string, number>;
  ok: boolean;
}

/**
 * Replays every unexpired tombstone against `target`, then verifies that nothing remains for any
 * tombstoned account. The report contains counts only — no personal data.
 */
export async function replayTombstones(models: Models, target: Connection, hmacKey: string): Promise<ReplayReport> {
  const now = new Date();
  const tombstones = await models.Tombstone.find({ expiresAt: { $gt: now } }).lean();
  const userIds = tombstones.map((t) => t.userId);
  const hmacs = new Set(tombstones.map((t) => t.emailHmac));

  let processed = 0;
  for (const t of tombstones) {
    await deleteUserData(target, t.userId);
    processed += 1;
  }

  // betaInvites has no userId; match restored invites by keyed email hash.
  let invitesDeleted = 0;
  const invites = target.collection<{ _id: Types.ObjectId; email: string }>('betaInvites');
  for await (const invite of invites.find({}, { projection: { email: 1 } })) {
    if (hmacs.has(hmacSha256(hmacKey, normaliseEmail(invite.email)))) {
      await invites.deleteOne({ _id: invite._id });
      invitesDeleted += 1;
    }
  }

  const remainingDocuments: Record<string, number> = {
    users: userIds.length ? await target.collection('users').countDocuments({ _id: { $in: userIds } }) : 0,
  };
  for (const name of USER_OWNED_COLLECTIONS) {
    remainingDocuments[name] = userIds.length
      ? await target.collection(name).countDocuments({ userId: { $in: userIds } })
      : 0;
  }
  let invitesRemaining = 0;
  for await (const invite of invites.find({}, { projection: { email: 1 } })) {
    if (hmacs.has(hmacSha256(hmacKey, normaliseEmail(invite.email)))) invitesRemaining += 1;
  }
  remainingDocuments.betaInvites = invitesRemaining;

  const ok = processed === tombstones.length && Object.values(remainingDocuments).every((n) => n === 0);
  return { tombstonesRead: tombstones.length, tombstonesProcessed: processed, invitesDeleted, remainingDocuments, ok };
}
