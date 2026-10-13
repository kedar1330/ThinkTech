import type { Logger } from 'pino';
import { z } from 'zod';
import { emailSchema, fullNameSchema, passwordSchema } from '@styleme/contracts';
import type { Models } from '../models/index';
import { hashPassword } from './passwords';
import { SessionService } from './sessions';

// Admin bootstrap (D-95). Admin accounts are never created through registration: registration only
// creates `user` accounts. The operator seeds the admin from environment variables, so the password
// never appears in source control. The seeded account is verified and skips onboarding, so the admin
// logs in directly with email and password.

export const adminSeedSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: fullNameSchema.default('StyleMe Admin'),
});
export type AdminSeedInput = z.input<typeof adminSeedSchema>;

export type AdminSeedResult = 'created' | 'password_reset' | 'unchanged';

/** Reads SEED_ADMIN_* variables; reports variable names only, never values. */
export function adminSeedFromEnv(env: NodeJS.ProcessEnv = process.env): z.output<typeof adminSeedSchema> {
  const parsed = adminSeedSchema.safeParse({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    name: env.SEED_ADMIN_NAME?.trim() ? env.SEED_ADMIN_NAME : undefined,
  });
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => `SEED_ADMIN_${String(i.path[0]).toUpperCase()}`))];
    const policy = parsed.error.issues.some((i) => i.path[0] === 'password')
      ? ' (the password must meet the password policy: 8+ characters with upper case, lower case, a number and a special character)'
      : '';
    throw new Error(`Invalid or missing: ${names.join(', ')}${policy}`);
  }
  return parsed.data;
}

/**
 * Idempotent: creates the admin if missing; leaves an existing admin unchanged unless `resetPassword`
 * is set (then the password is replaced, lockout cleared and every session revoked). Refuses to turn
 * an existing `user` account into an admin; use `pnpm admin set-role` deliberately for that.
 */
export async function seedAdmin(
  models: Models,
  secret: string,
  input: AdminSeedInput,
  options: { resetPassword?: boolean; logger?: Logger } = {},
): Promise<AdminSeedResult> {
  const { email, password, name } = adminSeedSchema.parse(input);
  const existing = await models.User.findOne({ email }).lean();

  if (existing && existing.role !== 'admin') {
    throw new Error('A user account with that email already exists; it was not changed');
  }

  const now = new Date();
  if (!existing) {
    const created = await models.User.create({
      email,
      name,
      role: 'admin',
      passwordHash: await hashPassword(password),
      passwordChangedAt: now,
      emailVerifiedAt: now,
    });
    options.logger?.info({ event: 'admin_seeded', userId: String(created._id) });
    return 'created';
  }

  if (!options.resetPassword) return 'unchanged';

  await models.User.updateOne(
    { _id: existing._id },
    {
      $set: {
        passwordHash: await hashPassword(password),
        passwordChangedAt: now,
        isActive: true,
        emailVerifiedAt: existing.emailVerifiedAt ?? now,
        'loginSecurity.failedCount': 0,
        'loginSecurity.lockedUntil': null,
      },
      $inc: { tokenVersion: 1 },
    },
  );
  await new SessionService(models, secret).revokeAll(existing._id);
  options.logger?.info({ event: 'admin_password_reset_by_seed', userId: String(existing._id) });
  return 'password_reset';
}
