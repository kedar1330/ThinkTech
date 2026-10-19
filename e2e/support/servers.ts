import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createWriteStream, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { SERVER_LOG_DIR } from './settings';

// Lifecycle helpers for the local harness: start a Node server with its output in a log file, wait
// until it answers, and stop it (with its child processes) again.

export interface Harness {
  mongo?: MongoMemoryServer;
  servers: ChildProcess[];
}

// Global setup and teardown run in the same Playwright runner process; they hand over through here.
const KEY = Symbol.for('styleme.e2e.harness');
type WithHarness = typeof globalThis & { [KEY]?: Harness };

export function harness(): Harness {
  const g = globalThis as WithHarness;
  g[KEY] ??= { servers: [] };
  return g[KEY];
}

export function logFile(name: string): string {
  return join(SERVER_LOG_DIR, `${name}.log`);
}

/** Starts `node <args>` with its stdout and stderr written to `.logs/<name>.log`. */
export function startNode(name: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) {
  const log = createWriteStream(logFile(name));
  const child = spawn(process.execPath, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    // Its own process group on POSIX, so stopping it also stops anything it spawned.
    detached: process.platform !== 'win32',
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  harness().servers.push(child);
  return child;
}

function tail(name: string): string {
  try {
    return readFileSync(logFile(name), 'utf8').split('\n').slice(-30).join('\n');
  } catch {
    return '(no output)';
  }
}

/** Resolves once `url` answers with a 2xx status; fails early if the server process exits. */
export async function waitForHttp(name: string, url: string, child: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${name} exited with code ${child.exitCode} before it was ready:\n${tail(name)}`);
    }
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${name} did not answer ${url} within ${timeoutMs / 1000}s:\n${tail(name)}`);
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.pid === undefined) return;
  const exited = new Promise<void>((r) => child.once('exit', () => r()));
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
  const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), 10_000));
  if ((await Promise.race([exited, timeout])) === 'timeout' && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

/** Stops the servers (newest first) and the database. Safe to call more than once. */
export async function stopHarness(): Promise<void> {
  const h = harness();
  for (const child of h.servers.splice(0).reverse()) await stop(child);
  const mongo = h.mongo;
  h.mongo = undefined;
  await mongo?.stop();
}
