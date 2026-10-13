import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES } from '@styleme/contracts';
import { BFF_KEY_HEADER, CLIENT_IP_HEADER } from '../../src/middleware/client-ip';
import { BASE_CONFIG, PASSWORD, bearer, invite, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
});

describe('registration, login and identity', () => {
  it('T-01: register (invited), log in and read identity without passwordHash', async () => {
    const { app } = env.makeApp();
    const user = await registerUser(app, env, 'Ana@Example.com');
    expect(user.email).toBe('ana@example.com');
    expect(user).not.toHaveProperty('passwordHash');

    const token = await login(app, 'ana@example.com');
    const me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      success: true,
      data: { id: user.id, email: 'ana@example.com', name: 'Test User', role: 'user' },
    });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');

    const invite = await env.db.models.BetaInvite.findOne({ email: 'ana@example.com' }).lean();
    expect(invite?.usedAt).toBeInstanceOf(Date);
  });

  it('T-02: wrong password gives the generic error, then RATE_LIMITED after 5 attempts a minute', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'bo@example.com');
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'bo@example.com', password: 'wrong-password' });
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ code: 'UNAUTHENTICATED', message: AUTH_MESSAGES.loginFailed });
    }
    const limited = await request(app).post('/v1/auth/login').send({ email: 'bo@example.com', password: PASSWORD });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });

  it('T-03: protected endpoints reject missing, malformed and foreign-signed tokens', async () => {
    const { app } = env.makeApp();
    const user = await registerUser(app, env, 'cy@example.com');
    const forged = jwt.sign({ sub: user.id, tv: 0, sid: 'x' }, 'some-other-secret-0123456789abcdefghij', {
      algorithm: 'HS256',
    });
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, tv: 0, sid: 'x' })}.`;
    for (const headers of [{}, bearer('not-a-jwt'), bearer(forged), bearer(unsigned)]) {
      const res = await request(app).get('/v1/auth/me').set(headers);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
    }
  });

  it('T-05: incrementing tokenVersion or deactivating the user rejects old tokens; inactive users cannot log in', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'di@example.com');
    const token = await login(app, 'di@example.com');
    await env.db.models.User.updateOne({ email: 'di@example.com' }, { $inc: { tokenVersion: 1 } });
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);

    const fresh = await login(app, 'di@example.com');
    await env.db.models.User.updateOne({ email: 'di@example.com' }, { $set: { isActive: false } });
    expect((await request(app).get('/v1/auth/me').set(bearer(fresh))).status).toBe(401);
    const res = await request(app).post('/v1/auth/login').send({ email: 'di@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe(AUTH_MESSAGES.loginFailed);
  });

  it('T-37: closed beta — invited email registers; uninvited email gets the generic refusal and no user is created', async () => {
    const { app } = env.makeApp();
    await invite(env, 'ed@example.com');
    const ok = await request(app)
      .post('/v1/auth/register')
      .send({ email: 'ed@example.com', password: PASSWORD, name: 'Ed' });
    expect(ok.status).toBe(201);

    const refused = await request(app)
      .post('/v1/auth/register')
      .send({ email: 'fi@example.com', password: PASSWORD, name: 'Fi' });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toEqual({ code: 'FORBIDDEN', message: AUTH_MESSAGES.registrationRefused });
    expect(await env.db.models.User.countDocuments({ email: 'fi@example.com' })).toBe(0);
  });

  it('public sign-up enabled: no invite needed', async () => {
    const { app } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: 'gu@example.com', password: PASSWORD, name: 'Gu' });
    expect(res.status).toBe(201);
  });

  it('rejects invalid registration input (short password, bad email, missing name)', async () => {
    const { app } = env.makeApp();
    await invite(env, 'ha@example.com');
    for (const body of [
      { email: 'ha@example.com', password: 'short', name: 'Ha' },
      { email: 'not-an-email', password: PASSWORD, name: 'Ha' },
      { email: 'ha@example.com', password: PASSWORD },
    ]) {
      const res = await request(app).post('/v1/auth/register').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('T-49: login and registration refusals are identical across cases', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'io@example.com');
    await registerUser(app, env, 'jo@example.com');
    await env.db.models.User.updateOne({ email: 'jo@example.com' }, { $set: { isActive: false } });

    const unknown = await request(app).post('/v1/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    const wrong = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'io@example.com', password: 'wrong-password' });
    const inactive = await request(app).post('/v1/auth/login').send({ email: 'jo@example.com', password: PASSWORD });
    for (const res of [wrong, inactive]) {
      expect(res.status).toBe(unknown.status);
      expect(res.body).toEqual(unknown.body);
    }

    const { app: app2 } = env.makeApp();
    const uninvited = await request(app2)
      .post('/v1/auth/register')
      .send({ email: 'ka@example.com', password: PASSWORD, name: 'Ka' });
    const existing = await request(app2)
      .post('/v1/auth/register')
      .send({ email: 'io@example.com', password: PASSWORD, name: 'Io' });
    expect(existing.status).toBe(uninvited.status);
    expect(existing.body).toEqual(uninvited.body);
  });
});

describe('sessions, logout and password change', () => {
  it('T-46: logout revokes only that session; password change revokes every other session', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'la@example.com');
    const a = await login(app, 'la@example.com');
    const b = await login(app, 'la@example.com');

    const out = await request(app).post('/v1/auth/logout').set(bearer(a));
    expect(out.status).toBe(200);
    expect(out.body.data).toEqual({ loggedOut: true });
    // Replaying the logged-out token (e.g. a copied cookie) fails; the other session still works.
    expect((await request(app).get('/v1/auth/me').set(bearer(a))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(b))).status).toBe(200);

    const changed = await request(app)
      .put('/v1/auth/password')
      .set(bearer(b))
      .send({ currentPassword: PASSWORD, newPassword: 'a brand new password' });
    expect(changed.status).toBe(200);
    const c = changed.body.data.accessToken as string;
    expect((await request(app).get('/v1/auth/me').set(bearer(b))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(c))).status).toBe(200);
    expect(await env.db.models.Session.countDocuments()).toBe(1);
  });

  it('T-39: change password — correct current password works; wrong one changes nothing', async () => {
    const { app } = env.makeApp();
    const user = await registerUser(app, env, 'mo@example.com');
    const token = await login(app, 'mo@example.com');
    const { authService } = env.makeApp();
    await authService.issueResetToken((await env.db.models.User.findById(user.id).lean())!._id, 'admin_issued');

    const wrong = await request(app)
      .put('/v1/auth/password')
      .set(bearer(token))
      .send({ currentPassword: 'not my password', newPassword: 'a brand new password' });
    expect(wrong.status).toBe(403);
    expect(wrong.body.error.code).toBe('PASSWORD_INCORRECT');
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(200);

    const ok = await request(app)
      .put('/v1/auth/password')
      .set(bearer(token))
      .send({ currentPassword: PASSWORD, newPassword: 'a brand new password' });
    expect(ok.status).toBe(200);
    expect(await env.db.models.PasswordResetToken.countDocuments()).toBe(0);
    await expect(login(app, 'mo@example.com')).rejects.toThrow();
    await login(app, 'mo@example.com', 'a brand new password');
    const stored = await env.db.models.User.findById(user.id).lean();
    expect(stored?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(stored?.passwordChangedAt).toBeInstanceOf(Date);
  });

  it('expired session record is rejected even before TTL cleanup', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'ni@example.com');
    const token = await login(app, 'ni@example.com');
    await env.db.models.Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
  });
});

describe('rate limits and client IP', () => {
  it('T-36: register 3/min per IP; password change 5/hour per user; account deletion 3/hour per user', async () => {
    const { app } = env.makeApp();
    const statuses: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      statuses.push(
        (
          await request(app)
            .post('/v1/auth/register')
            .send({ email: `r${i}@example.com`, password: PASSWORD, name: 'R' })
        ).status,
      );
    }
    expect(statuses).toEqual([403, 403, 403, 429]);

    const { app: app2 } = env.makeApp();
    await registerUser(app2, env, 'ol@example.com');
    const token = await login(app2, 'ol@example.com');
    const change = () =>
      request(app2)
        .put('/v1/auth/password')
        .set(bearer(token))
        .send({ currentPassword: 'wrong-password', newPassword: 'whatever123' });
    for (let i = 0; i < 5; i += 1) expect((await change()).status).toBe(403);
    expect((await change()).status).toBe(429);

    const del = () => request(app2).delete('/v1/account').set(bearer(token)).send({ password: 'wrong-password' });
    for (let i = 0; i < 3; i += 1) expect((await del()).status).toBe(403);
    expect((await del()).status).toBe(429);
  });

  it('per-IP limits use the BFF-forwarded client IP only when the BFF secret is present', async () => {
    const { app } = env.makeApp();
    const attempt = (ip: string, key?: string) => {
      const req = request(app).post('/v1/auth/login').set(CLIENT_IP_HEADER, ip);
      if (key) req.set(BFF_KEY_HEADER, key);
      return req.send({ email: 'nobody@example.com', password: 'x' });
    };
    // Five failures from one user's IP exhaust that IP only.
    for (let i = 0; i < 5; i += 1)
      expect((await attempt('203.0.113.1', BASE_CONFIG.BFF_SHARED_SECRET)).status).toBe(401);
    expect((await attempt('203.0.113.1', BASE_CONFIG.BFF_SHARED_SECRET)).status).toBe(429);
    expect((await attempt('203.0.113.2', BASE_CONFIG.BFF_SHARED_SECRET)).status).toBe(401);

    // Without the secret, a spoofed client-IP header is ignored: attempts share the caller's address.
    const { app: app2 } = env.makeApp();
    const spoof = (ip: string) =>
      request(app2)
        .post('/v1/auth/login')
        .set(CLIENT_IP_HEADER, ip)
        .send({ email: 'nobody@example.com', password: 'x' });
    for (let i = 0; i < 5; i += 1) expect((await spoof(`198.51.100.${i}`)).status).toBe(401);
    expect((await spoof('198.51.100.99')).status).toBe(429);
  });
});

describe('envelope, maintenance and logging', () => {
  it('T-35: errors use the envelope without internals; unknown routes are NOT_FOUND', async () => {
    const { app } = env.makeApp();
    const bad = await request(app).post('/v1/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request data' } });
    const missing = await request(app).get('/v1/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
    expect(JSON.stringify(bad.body)).not.toMatch(/stack|Error:|at /);
  });

  it('T-45: maintenance mode — every /v1 endpoint is unavailable and /health reports maintenance', async () => {
    const { app } = env.makeApp({ MAINTENANCE_MODE: true });
    const res = await request(app).post('/v1/auth/login').send({ email: 'a@example.com', password: PASSWORD });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('maintenance');
  });

  it('/health reports ok without authentication', async () => {
    const { app } = env.makeApp();
    const health = await request(app).get('/health');
    expect(health.body).toMatchObject({ status: 'ok', version: expect.any(String), time: expect.any(String) });
  });

  it('logs never contain passwords, access tokens or Authorization headers', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'pa@example.com');
    const token = await login(app, 'pa@example.com');
    await request(app).get('/v1/auth/me').set(bearer(token));
    await request(app)
      .put('/v1/auth/password')
      .set(bearer(token))
      .send({ currentPassword: PASSWORD, newPassword: 'another secret pw' });
    const logs = env.logLines.join('\n');
    expect(logs.length).toBeGreaterThan(0);
    for (const secret of [PASSWORD, 'another secret pw', token, 'Bearer']) expect(logs).not.toContain(secret);
  });
});
