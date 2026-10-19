import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Settings shared by the Playwright config, global setup/teardown and the fixtures. Everything can be
// overridden with environment variables; nothing here is a secret (the servers' secrets are generated
// at start-up, see global-setup.ts).

export const E2E_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(E2E_DIR, '..');

/** Set to run the flows against an already running deployment instead of starting local servers. */
export const EXTERNAL_BASE_URL = process.env.BASE_URL?.trim() || undefined;

export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3100);
export const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);

export const BASE_URL = (EXTERNAL_BASE_URL ?? `http://localhost:${WEB_PORT}`).replace(/\/$/, '');
export const API_URL = `http://127.0.0.1:${API_PORT}`;

/**
 * Where the API's dev outbox writes each email as a JSON file (APP_ENV=local without SMTP). The local
 * harness points the API here; against BASE_URL, set E2E_OUTBOX_DIR to that deployment's outbox.
 */
export const OUTBOX_DIR = resolve(process.env.E2E_OUTBOX_DIR ?? join(E2E_DIR, '.outbox'));

/** API and web server output of the local harness (uploaded by CI when the job fails). */
export const SERVER_LOG_DIR = join(E2E_DIR, '.logs');

/** True when this run started the servers itself, so their logs and outbox are on this machine. */
export const LOCAL_SERVERS = EXTERNAL_BASE_URL === undefined;
