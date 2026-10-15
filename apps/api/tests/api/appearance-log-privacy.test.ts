import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Reproduces the CI failure of T-11 deterministically: every request gets the request ID from the
// failed run, which contains "4-5". The app's request IDs come from `randomUUID` (genReqId in app.ts).
const CI_REQUEST_ID = '93cba67a-7cc1-4b4f-a454-59aef00afa19';
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  randomUUID: () => CI_REQUEST_ID,
}));

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});

describe('T-11 with a request ID that contains "4-5"', () => {
  it('appearance values are still never logged, and the request ID does not cause a false failure', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ha@example.com');
    const token = await login(app, 'ha@example.com');
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({
        skinTone: { value: { monkRange: '4-5' } },
        undertone: { value: 'olive' },
        bodyProportions: { value: 'balanced_defined_waist' },
      })
      .expect(200);
    const res = await request(app).get('/v1/appearance').set(bearer(token));
    expect(res.headers['x-request-id']).toBe(CI_REQUEST_ID);

    // The raw log contains "4-5" only because of the request ID: the old assertion failed here.
    const raw = env.logLines.join('\n');
    expect(raw).toContain(CI_REQUEST_ID);
    expect(raw.replaceAll(CI_REQUEST_ID, '')).not.toContain('4-5');

    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).toContain('/v1/appearance');
    for (const value of ['4-5', 'olive', 'balanced_defined_waist', 'monkRange']) expect(logs).not.toContain(value);
  });
});
