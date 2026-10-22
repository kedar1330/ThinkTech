import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { harness, startNode, stopHarness, waitForHttp } from './support/servers';
import {
  API_PORT,
  API_URL,
  BASE_URL,
  EXTERNAL_BASE_URL,
  OUTBOX_DIR,
  REPO_ROOT,
  SERVER_LOG_DIR,
  WEB_PORT,
} from './support/settings';

// Starts a hermetic stack for the suite: in-memory MongoDB → API (APP_ENV=local, emails written to
// the dev outbox) → `next start`. Nothing is shared with a developer's own database or servers.

const API_DIR = join(REPO_ROOT, 'apps', 'api');
const WEB_DIR = join(REPO_ROOT, 'apps', 'web');
const API_ENTRY = join(API_DIR, 'dist', 'server.js');
const NEXT_BIN = join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
const TSX_CLI = join(API_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/** A fresh random value per run, so the suite needs no stored secrets. */
const secret = () => randomBytes(32).toString('hex');

export default async function globalSetup(): Promise<void> {
  if (EXTERNAL_BASE_URL) {
    console.log(`[e2e] BASE_URL is set: running against ${EXTERNAL_BASE_URL} without starting local servers.`);
    return;
  }
  for (const [file, what] of [
    [API_ENTRY, 'API'],
    [join(WEB_DIR, '.next', 'BUILD_ID'), 'web app'],
  ] as const) {
    if (!existsSync(file)) throw new Error(`[e2e] The ${what} is not built (${file} is missing). Run \`pnpm build\`.`);
  }

  rmSync(OUTBOX_DIR, { recursive: true, force: true });
  rmSync(SERVER_LOG_DIR, { recursive: true, force: true });
  mkdirSync(OUTBOX_DIR, { recursive: true });
  mkdirSync(SERVER_LOG_DIR, { recursive: true });

  const bffSecret = secret();
  try {
    const mongo = await MongoMemoryServer.create();
    harness().mongo = mongo;

    const apiEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(API_PORT),
      APP_ENV: 'local',
      MONGODB_URI: mongo.getUri('styleme_e2e'),
      TOMBSTONE_STORE_URI: mongo.getUri('styleme_e2e_tombstones'),
      TOMBSTONE_HMAC_KEY: secret(),
      AUTH_ACCESS_TOKEN_SECRET: secret(),
      BFF_SHARED_SECRET: bffSecret,
      WEB_ORIGIN: BASE_URL,
      PUBLIC_SIGNUP_ENABLED: 'true',
      MAINTENANCE_MODE: 'false',
      // No email provider: every message is written to the dev outbox, where the fixtures read it.
      SMTP_URL: '',
      EMAIL_FROM: '',
      DEV_OUTBOX_DIR: OUTBOX_DIR,
      DEV_ECHO_MESSAGES: 'false',
      GOOGLE_CLIENT_ID: '',
    };

    // Discover My Style builds looks around a design saved in Outfit Categories (D-132), so the design
    // catalogue and its approved rules are seeded first (`design:seed`).
    // Asynchronous on purpose: the in-memory MongoDB's output is read by this process, so blocking it
    // (spawnSync) would stall the database the seed is writing to.
    await new Promise<void>((resolve, reject) => {
      const seed = spawn(process.execPath, [TSX_CLI, join('scripts', 'design-catalogue.ts'), 'seed'], {
        cwd: API_DIR,
        env: apiEnv,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      seed.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      seed.on('error', reject);
      seed.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`[e2e] Seeding the design catalogue failed:\n${stderr}`)),
      );
    });

    const api = startNode('api', [API_ENTRY], { cwd: API_DIR, env: apiEnv });
    await waitForHttp('api', `${API_URL}/health`, api);

    const web = startNode('web', [NEXT_BIN, 'start', '-p', String(WEB_PORT)], {
      cwd: WEB_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        AUTH_URL: BASE_URL,
        API_BASE_URL: API_URL,
        BFF_SHARED_SECRET: bffSecret,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      },
    });
    await waitForHttp('web', `${BASE_URL}/login`, web);
    console.log(`[e2e] MongoDB (in memory), API ${API_URL} and web ${BASE_URL} are up.`);
  } catch (err) {
    await stopHarness();
    throw err;
  }
}
