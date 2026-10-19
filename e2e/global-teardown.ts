import { stopHarness } from './support/servers';

/** Stops `next start`, the API and the in-memory MongoDB started by global-setup.ts. */
export default async function globalTeardown(): Promise<void> {
  await stopHarness();
}
