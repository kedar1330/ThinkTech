import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { replayTombstones } from '../../src/services/account-deletion';
import { BASE_CONFIG, PASSWORD, bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
  vi.restoreAllMocks();
});

describe('envelope, maintenance and logging', () => {
  it('T-35: errors use the envelope without internals; unknown routes are NOT_FOUND', async () => {
    const { app } = env.makeApp();
    const bad = await request(app).post('/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request data' } });
    expect((await request(app).get('/v1/nope')).body.error.code).toBe('NOT_FOUND');
  });

  it('T-45: maintenance mode — /v1 unavailable, /health reports maintenance', async () => {
    const { app } = env.makeApp({ MAINTENANCE_MODE: true });
    expect(
      (await request(app).post('/v1/auth/login').send({ email: 'a@example.com', password: PASSWORD })).status,
    ).toBe(503);
    expect((await request(app).get('/health')).body.status).toBe('maintenance');
  });

  it('logs never contain passwords, codes, link tokens, access tokens or Authorization headers', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ana@example.com');
    const otp = mail.otp('ana@example.com');
    const token = await login(app, 'ana@example.com');
    await request(app).get('/v1/auth/me').set(bearer(token));
    await request(app).post('/v1/auth/password-reset/request').send({ email: 'ana@example.com', method: 'link' });
    const link = mail.linkToken('ana@example.com');
    const logs = env.logLines.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const secret of [PASSWORD, otp, link, token, 'Bearer']) expect(logs).not.toContain(secret);
  });
});

describe('tombstones (D-85)', () => {
  it('T-44: tombstone store unavailable → SERVICE_UNAVAILABLE and nothing is deleted', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'bo@example.com');
    const token = await login(app, 'bo@example.com');
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    vi.spyOn(env.db.models.Tombstone, 'create').mockRejectedValueOnce(new Error('tombstone store down'));
    const res = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('bo@example.com'), confirm: true });
    expect(res.status).toBe(503);
    expect(await env.db.models.User.countDocuments({ email: 'bo@example.com' })).toBe(1);
  });

  it('T-43 (service level): replay against a restored copy deletes accounts deleted after the backup', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'cy@example.com');
    await registerUser(app, env, mail, 'keep@example.com');
    const token = await login(app, 'cy@example.com');
    const restored = env.db.main.useDb('styleme_restored');
    for (const name of ['users', 'betaInvites', 'sessions', 'authChallenges']) {
      const docs = await env.db.main.collection(name).find().toArray();
      if (docs.length) await restored.collection(name).insertMany(docs);
    }
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const del = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('cy@example.com'), confirm: true });
    expect(del.status).toBe(200);
    const report = await replayTombstones(env.db.models, restored, BASE_CONFIG.TOMBSTONE_HMAC_KEY);
    expect(report).toMatchObject({ tombstonesRead: 1, tombstonesProcessed: 1, invitesDeleted: 1, ok: true });
    expect(await restored.collection('users').countDocuments({ email: 'cy@example.com' })).toBe(0);
    expect(await restored.collection('users').countDocuments({ email: 'keep@example.com' })).toBe(1);
    await restored.dropDatabase();
  });
});
