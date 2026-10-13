import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { connectDatabase, type Database } from '../src/db';
import { createLogger } from '../src/logger';
import { identityFromClaims, type GoogleVerifier } from '../src/services/google';
import type { EmailMessage, EmailSender, SmsMessage, SmsSender } from '../src/services/messaging';

/** Meets the password policy (upper, lower, number, special, ≥ 8). */
export const PASSWORD = 'Correct-Horse-9';
export const NEW_PASSWORD = 'Brand-New-Pass-7';

export const BASE_CONFIG: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  APP_ENV: 'local',
  MONGODB_URI: 'set-by-test-env',
  TOMBSTONE_STORE_URI: 'set-by-test-env',
  TOMBSTONE_HMAC_KEY: 'test-tombstone-hmac-key-0123456789abcdef',
  AUTH_ACCESS_TOKEN_SECRET: 'test-access-token-secret-0123456789abcdef',
  BFF_SHARED_SECRET: 'test-bff-shared-secret-0123456789abcdef',
  WEB_ORIGIN: 'http://localhost:3000',
  PUBLIC_SIGNUP_ENABLED: false,
  MAINTENANCE_MODE: false,
  SMTP_URL: undefined,
  EMAIL_FROM: undefined,
  SMS_PROVIDER: 'none',
  DEV_OUTBOX_DIR: '.dev-outbox-test',
  DEV_ECHO_MESSAGES: false,
  GOOGLE_CLIENT_ID: undefined,
};

/** Captures messages instead of sending them; extracts codes and link tokens for the tests. */
export class RecordingEmailSender implements EmailSender {
  readonly kind = 'test' as const;
  readonly sent: EmailMessage[] = [];
  failNext = false;
  async send(message: EmailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('provider down');
    }
    this.sent.push(message);
  }
  last(to: string): EmailMessage {
    const message = [...this.sent].reverse().find((m) => m.to === to);
    if (!message) throw new Error(`no email to ${to}`);
    return message;
  }
  otp(to: string): string {
    const match = /\b(\d{6})\b/.exec(this.last(to).text);
    if (!match) throw new Error(`no code in email to ${to}`);
    return match[1]!;
  }
  linkToken(to: string): string {
    const match = /#token=([A-Za-z0-9_-]+)/.exec(this.last(to).text);
    if (!match) throw new Error(`no link in email to ${to}`);
    return match[1]!;
  }
  count(to: string): number {
    return this.sent.filter((m) => m.to === to).length;
  }
}

export class RecordingSmsSender implements SmsSender {
  readonly kind = 'test' as const;
  readonly sent: SmsMessage[] = [];
  async send(message: SmsMessage) {
    this.sent.push(message);
  }
  otp(): string {
    const last = this.sent.at(-1);
    const match = last ? /\b(\d{6})\b/.exec(last.text) : null;
    if (!match) throw new Error('no SMS code');
    return match[1]!;
  }
}

/**
 * Stands in for Google's signature check: the test passes the ID token's claims as JSON, and the same
 * claim checks as production run on them (nonce, email_verified, sub, email).
 */
export const fakeGoogleVerifier: GoogleVerifier = async (idToken, nonce) =>
  identityFromClaims(JSON.parse(idToken) as Record<string, unknown>, nonce);

export function googleToken(claims: {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
}) {
  const nonce = claims.nonce ?? 'test-nonce-0123456789';
  return {
    idToken: JSON.stringify({ email_verified: true, name: 'Google User', ...claims, nonce }),
    nonce,
  };
}

export interface AppOptions {
  email?: RecordingEmailSender;
  sms?: RecordingSmsSender | null;
  google?: GoogleVerifier | null;
}

export interface TestEnv {
  mongo: MongoMemoryServer;
  db: Database;
  logLines: string[];
  /** A fresh app (fresh in-memory rate limits) with optional config overrides and providers. */
  makeApp(
    overrides?: Partial<Config>,
    options?: AppOptions,
  ): ReturnType<typeof createApp> & { config: Config; mail: RecordingEmailSender; sms: RecordingSmsSender | null };
  reset(): Promise<void>;
  stop(): Promise<void>;
}

/** One in-memory MongoDB per test file, with separate main and tombstone databases (D-85). */
export async function startTestEnv(): Promise<TestEnv> {
  const mongo = await MongoMemoryServer.create();
  const db = await connectDatabase(mongo.getUri('styleme'), mongo.getUri('styleme_tombstones'));
  const logLines: string[] = [];
  const logger = createLogger({ write: (line: string) => void logLines.push(line) });

  return {
    mongo,
    db,
    logLines,
    makeApp(overrides = {}, options = {}) {
      const config = { ...BASE_CONFIG, ...overrides };
      const mail = options.email ?? new RecordingEmailSender();
      const sms = options.sms === undefined ? new RecordingSmsSender() : options.sms;
      const app = createApp({
        config,
        db,
        logger,
        emailSender: mail,
        smsSender: sms,
        googleVerifier: options.google === undefined ? fakeGoogleVerifier : options.google,
      });
      return { ...app, config, mail, sms };
    },
    async reset() {
      for (const conn of [db.main, db.tombstones]) {
        const collections = await conn.db!.collections();
        await Promise.all(collections.map((c) => c.deleteMany({})));
      }
      logLines.length = 0;
    },
    async stop() {
      await db.close();
      await mongo.stop();
    },
  };
}

export async function invite(env: TestEnv, email: string): Promise<void> {
  await env.db.models.BetaInvite.updateOne(
    { email },
    { $setOnInsert: { email, invitedAt: new Date() } },
    { upsert: true },
  );
}

export function registration(email: string, extra: Record<string, unknown> = {}) {
  return {
    fullName: 'Test User',
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    city: 'mumbai',
    acceptTerms: true,
    ...extra,
  };
}

/** Registers (invited) without verifying. Returns the pending-registration token. */
export async function registerPending(app: Express, env: TestEnv, email: string, extra: Record<string, unknown> = {}) {
  await invite(env, email);
  const res = await request(app).post('/v1/auth/register').send(registration(email, extra));
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { email: string; pendingToken: string; verificationEmailSent: boolean };
}

/** Registers and verifies by code. Returns the user's ID and email. */
export async function registerUser(
  app: Express,
  env: TestEnv,
  mail: RecordingEmailSender,
  email: string,
): Promise<{ id: string; email: string }> {
  await registerPending(app, env, email);
  const res = await request(app)
    .post('/v1/auth/email-verification/otp')
    .send({ email, otp: mail.otp(email) });
  if (res.status !== 200) throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  const user = await env.db.models.User.findOne({ email }).lean();
  return { id: String(user!._id), email };
}

export async function login(app: Express, email: string, password = PASSWORD, rememberMe = false): Promise<string> {
  const res = await request(app).post('/v1/auth/login').send({ email, password, rememberMe });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken as string;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
