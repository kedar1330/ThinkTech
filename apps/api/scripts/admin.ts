// Operator commands for accounts (D-73: no admin UI; changes via server-side scripts).
//
//   pnpm admin invite-add <email> [--admin <adminEmail>]
//   pnpm admin invite-remove <email>
//   pnpm admin invite-list
//   pnpm admin issue-reset-code <email> --admin <adminEmail>
//   pnpm admin revoke-sessions <email>
//   pnpm admin set-active <email> <true|false>
//   pnpm admin set-role <email> <user|admin>
//
// issue-reset-code: verify the request first through a channel tied to the account (FR-AUTH-12).
// The code is printed once, to this terminal only, for out-of-band delivery. It is never logged,
// and the admin never sees or chooses the new password.

import type { Types } from 'mongoose';
import { emailSchema } from '@styleme/contracts';
import { loadConfig } from '../src/config/env';
import { connectDatabase, type Database } from '../src/db';
import { createLogger } from '../src/logger';
import { AuthService } from '../src/services/auth.service';

const logger = createLogger();

function usage(): never {
  process.stderr.write('See the comment at the top of scripts/admin.ts for usage.\n');
  process.exit(2);
}

function parseEmail(value: string | undefined): string {
  const parsed = emailSchema.safeParse(value);
  if (!parsed.success) usage();
  return parsed.data;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function findAdminId(
  db: Database,
  adminEmail: string | undefined,
  required: boolean,
): Promise<Types.ObjectId | null> {
  if (!adminEmail) {
    if (required) throw new Error('--admin <adminEmail> is required');
    return null;
  }
  const admin = await db.models.User.findOne({ email: parseEmail(adminEmail), role: 'admin', isActive: true }).lean();
  if (!admin) throw new Error('No active admin account with that email');
  return admin._id;
}

async function findUser(db: Database, email: string) {
  const user = await db.models.User.findOne({ email }).lean();
  if (!user) throw new Error('No account with that email');
  return user;
}

async function run(db: Database, args: string[]): Promise<void> {
  const [command, arg1, arg2] = args;
  const config = loadConfig();
  // Operator commands never send email; a sender that refuses keeps that explicit.
  const email = {
    kind: 'test' as const,
    send: async () => Promise.reject(new Error('admin script does not send email')),
  };
  const auth = new AuthService({ config, models: db.models, main: db.main, email, logger, google: null });

  switch (command) {
    case 'invite-add': {
      const email = parseEmail(arg1);
      const invitedBy = await findAdminId(db, flag(args, '--admin'), false);
      await db.models.BetaInvite.updateOne(
        { email },
        { $setOnInsert: { email, invitedAt: new Date(), invitedBy, usedAt: null } },
        { upsert: true },
      );
      logger.info({ event: 'beta_invite_added', invitedBy: invitedBy ? String(invitedBy) : null });
      process.stdout.write('Invite recorded.\n');
      return;
    }
    case 'invite-remove': {
      const result = await db.models.BetaInvite.deleteOne({ email: parseEmail(arg1) });
      process.stdout.write(result.deletedCount ? 'Invite removed.\n' : 'No invite for that email.\n');
      return;
    }
    case 'invite-list': {
      const invites = await db.models.BetaInvite.find().sort({ invitedAt: 1 }).lean();
      for (const i of invites) {
        process.stdout.write(`${i.email}\t${i.usedAt ? 'registered' : 'pending'}\n`);
      }
      return;
    }
    case 'issue-reset-code': {
      const email = parseEmail(arg1);
      const adminId = await findAdminId(db, flag(args, '--admin'), true);
      const user = await findUser(db, email);
      if (!user.isActive) throw new Error('That account is inactive');
      const code = await auth.issueAdminResetCode(user._id, adminId);
      process.stdout.write(
        `Single-use reset code (valid 60 minutes). Deliver it out of band; it is not shown again:\n\n${code}\n\n` +
          'The user enters it on the reset-password page and chooses their own new password.\n',
      );
      return;
    }
    case 'revoke-sessions': {
      const user = await findUser(db, parseEmail(arg1));
      await db.models.User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
      await auth.sessions.revokeAll(user._id);
      logger.info({ event: 'sessions_revoked_by_admin', userId: String(user._id) });
      process.stdout.write('All sessions revoked.\n');
      return;
    }
    case 'set-active': {
      if (arg2 !== 'true' && arg2 !== 'false') usage();
      const user = await findUser(db, parseEmail(arg1));
      const isActive = arg2 === 'true';
      await db.models.User.updateOne({ _id: user._id }, { $set: { isActive } });
      if (!isActive) await auth.sessions.revokeAll(user._id);
      logger.info({ event: 'account_active_changed', userId: String(user._id), isActive });
      process.stdout.write(`isActive set to ${arg2}.\n`);
      return;
    }
    case 'set-role': {
      if (arg2 !== 'user' && arg2 !== 'admin') usage();
      const user = await findUser(db, parseEmail(arg1));
      await db.models.User.updateOne({ _id: user._id }, { $set: { role: arg2 } });
      logger.info({ event: 'account_role_changed', userId: String(user._id), role: arg2 });
      process.stdout.write(`Role set to ${arg2}.\n`);
      return;
    }
    default:
      usage();
  }
}

async function main() {
  const config = loadConfig();
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    await run(db, process.argv.slice(2));
  } finally {
    await db.close();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
