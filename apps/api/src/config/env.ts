import { z } from 'zod';

// Environment configuration (DEPLOYMENT.md §3.1). Parsed once at startup; the process exits on invalid config.

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_ENV: z.enum(['local', 'staging', 'production']),
  MONGODB_URI: z.string().min(1),
  TOMBSTONE_STORE_URI: z.string().min(1),
  TOMBSTONE_HMAC_KEY: z.string().min(32),
  AUTH_ACCESS_TOKEN_SECRET: z.string().min(32),
  BFF_SHARED_SECRET: z.string().min(32),
  WEB_ORIGIN: z.url(),
  PUBLIC_SIGNUP_ENABLED: bool,
  PASSWORD_RESET_EMAIL_ENABLED: bool,
  MAINTENANCE_MODE: bool,
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Report variable names only, never values.
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  return parsed.data;
}

// Session and token lifetime: 7 days from login, never extended (D-05).
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Reset token lifetimes (D-83).
export const ADMIN_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_RESET_TTL_MS = 30 * 60 * 1000;

// Tombstones are kept for the backup retention period + 7 days (D-85). Backup retention is the
// proposed 30 days until the founder confirms it at HC-1 (D-79); change this constant with it.
export const BACKUP_RETENTION_DAYS = 30;
export const TOMBSTONE_RETENTION_MS = (BACKUP_RETENTION_DAYS + 7) * 24 * 60 * 60 * 1000;
