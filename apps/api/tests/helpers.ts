import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app';
import type { Config } from '../src/config/env';
import { connectDatabase, type Database } from '../src/db';
import { createLogger } from '../src/logger';
import type { EmailSender } from '../src/services/email';

export const PASSWORD = 'correct horse battery';

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
  PASSWORD_RESET_EMAIL_ENABLED: false,
  MAINTENANCE_MODE: false,
};

export class RecordingEmailSender implements EmailSender {
  readonly sent: { to: string; link: string }[] = [];
  async sendPasswordReset(to: string, link: string) {
    this.sent.push({ to, link });
  }
}

export interface TestEnv {
  mongo: MongoMemoryServer;
  db: Database;
  logLines: string[];
  /** A fresh app (fresh in-memory rate limits) with optional config overrides. */
  makeApp(overrides?: Partial<Config>, emailSender?: EmailSender): ReturnType<typeof createApp> & { config: Config };
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
    makeApp(overrides = {}, emailSender) {
      const config = { ...BASE_CONFIG, ...overrides };
      return { ...createApp({ config, db, logger, emailSender }), config };
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
  await env.db.models.BetaInvite.create({ email, invitedAt: new Date() });
}

export async function registerUser(app: Express, env: TestEnv, email: string, password = PASSWORD) {
  await invite(env, email);
  const res = await request(app).post('/v1/auth/register').send({ email, password, name: 'Test User' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data as { id: string; email: string };
}

export async function login(app: Express, email: string, password = PASSWORD): Promise<string> {
  const res = await request(app).post('/v1/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken as string;
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}
