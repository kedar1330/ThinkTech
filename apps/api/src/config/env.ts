import { z } from 'zod';

// Environment configuration (DEPLOYMENT.md §3.1). Parsed once at startup; the process exits on invalid config.

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? v.trim() : undefined));

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
  MAINTENANCE_MODE: bool,
  // Email (D-84): SMTP connection string of the chosen provider, e.g. smtps://user:pass@host:465.
  // Without it, local development writes messages to DEV_OUTBOX_DIR instead; staging and production
  // refuse to start.
  SMTP_URL: optional,
  EMAIL_FROM: optional,
  // SMS for optional phone verification (D-92). No provider is chosen yet; locally messages go to the
  // dev outbox, elsewhere phone verification reports that SMS isn't available.
  SMS_PROVIDER: z.enum(['none']).default('none'),
  DEV_OUTBOX_DIR: z.string().default('.dev-outbox'),
  // Local development only: also print each email/SMS (with its code and link) to the API terminal.
  // Ignored outside APP_ENV=local, so staging and production never print codes.
  DEV_ECHO_MESSAGES: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Google sign-in (D-88): the OAuth client ID that Google ID tokens must be issued for.
  GOOGLE_CLIENT_ID: optional,
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

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Sessions (D-91): Remember Me keeps a session for 30 days; otherwise the browser cookie ends with the
// browser session and the server stops accepting it after 24 hours. Never extended by activity.
export const SESSION_TTL_REMEMBER_MS = 30 * DAY;
export const SESSION_TTL_DEFAULT_MS = 1 * DAY;
/** @deprecated kept for older call sites; equals the Remember Me lifetime. */
export const SESSION_TTL_MS = SESSION_TTL_REMEMBER_MS;

// One-time codes and links (D-89).
export const OTP_TTL_MS = 5 * MINUTE;
export const VERIFICATION_LINK_TTL_MS = 30 * MINUTE;
export const RESET_LINK_TTL_MS = 15 * MINUTE;
export const ADMIN_RESET_TTL_MS = 60 * MINUTE;
export const EMAIL_CHANGE_LINK_TTL_MS = 30 * MINUTE;
/** A correct reset OTP is exchanged for a single-use token valid this long to set the new password. */
export const RESET_SESSION_TTL_MS = 10 * MINUTE;
export const OTP_MAX_FAILED_ATTEMPTS = 3;
export const OTP_LOCKOUT_MS = 30 * MINUTE;
export const RESEND_COOLDOWN_MS = 30 * 1000;
/** The first send plus up to 5 resends in any rolling hour. */
export const MAX_SENDS_PER_HOUR = 6;
/** How long a pending registration (and its challenge document) is kept for recovery. */
export const PENDING_REGISTRATION_TTL_MS = 1 * DAY;

// Failed-login lockout (D-90).
export const LOGIN_MAX_FAILED_ATTEMPTS = 3;
export const LOGIN_LOCKOUT_MS = 30 * MINUTE;

// Tombstones are kept for the backup retention period + 7 days (D-85). Backup retention is the
// proposed 30 days until the founder confirms it at HC-1 (D-79); change this constant with it.
export const BACKUP_RETENTION_DAYS = 30;
export const TOMBSTONE_RETENTION_MS = (BACKUP_RETENTION_DAYS + 7) * DAY;
