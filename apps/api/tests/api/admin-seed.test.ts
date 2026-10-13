import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { adminSeedFromEnv, seedAdmin } from '../../src/services/admin-seed';
import {
  BASE_CONFIG,
  NEW_PASSWORD,
  PASSWORD,
  bearer,
  googleToken,
  invite,
  login,
  registration,
  registerUser,
  startTestEnv,
  type TestEnv,
} from '../helpers';

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

const SECRET = BASE_CONFIG.AUTH_ACCESS_TOKEN_SECRET;
const ADMIN = { email: 'Admin@Example.com', password: PASSWORD, name: 'Ops Admin' };

describe('admin seed (D-95)', () => {
  it('creates a verified admin that logs in directly, with no invite, verification or onboarding', async () => {
    const { app, mail } = env.makeApp();
    expect(await seedAdmin(env.db.models, SECRET, ADMIN)).toBe('created');

    const res = await request(app).post('/v1/auth/login').send({ email: 'admin@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.onboardingStep).toBe('complete');
    const me = await request(app).get('/v1/auth/me').set(bearer(res.body.data.accessToken));
    expect(me.body.data).toMatchObject({ email: 'admin@example.com', name: 'Ops Admin', role: 'admin' });
    expect(mail.sent).toHaveLength(0);
  });

  it('is idempotent and never overwrites an existing admin password without --reset-password', async () => {
    const { app } = env.makeApp();
    await seedAdmin(env.db.models, SECRET, ADMIN);
    expect(await seedAdmin(env.db.models, SECRET, { ...ADMIN, password: NEW_PASSWORD })).toBe('unchanged');
    await login(app, 'admin@example.com', PASSWORD);
    expect(await env.db.models.User.countDocuments({ role: 'admin' })).toBe(1);
  });

  it('--reset-password replaces the password, clears a lockout and ends every session', async () => {
    const { app } = env.makeApp();
    await seedAdmin(env.db.models, SECRET, ADMIN);
    const token = await login(app, 'admin@example.com');
    await env.db.models.User.updateOne(
      { email: 'admin@example.com' },
      { $set: { 'loginSecurity.lockedUntil': new Date(Date.now() + 60_000) } },
    );

    const result = await seedAdmin(
      env.db.models,
      SECRET,
      { ...ADMIN, password: NEW_PASSWORD },
      { resetPassword: true },
    );
    expect(result).toBe('password_reset');
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
    await login(app, 'admin@example.com', NEW_PASSWORD);
  });

  it('refuses to promote an existing user account', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'admin@example.com');
    await expect(seedAdmin(env.db.models, SECRET, ADMIN)).rejects.toThrow(/user account/);
    const user = await env.db.models.User.findOne({ email: 'admin@example.com' }).lean();
    expect(user!.role).toBe('user');
  });

  it('rejects credentials that break the password policy and names variables only', () => {
    expect(() => adminSeedFromEnv({ SEED_ADMIN_EMAIL: 'admin@example.com', SEED_ADMIN_PASSWORD: 'weakpass' })).toThrow(
      /SEED_ADMIN_PASSWORD.*password policy/,
    );
    expect(() => adminSeedFromEnv({})).toThrow(/SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD/);
    try {
      adminSeedFromEnv({ SEED_ADMIN_EMAIL: 'admin@example.com', SEED_ADMIN_PASSWORD: 'weakpass' });
    } catch (err) {
      expect((err as Error).message).not.toContain('weakpass');
    }
    expect(adminSeedFromEnv({ SEED_ADMIN_EMAIL: 'a@example.com', SEED_ADMIN_PASSWORD: PASSWORD }).name).toBe(
      'StyleMe Admin',
    );
  });
});

describe('only users register (D-95)', () => {
  it('rejects a registration that tries to set a role', async () => {
    const { app } = env.makeApp();
    await invite(env, 'eve@example.com');
    const res = await request(app)
      .post('/v1/auth/register')
      .send(registration('eve@example.com', { role: 'admin' }));
    expect(res.status).toBe(400);
    expect(await env.db.models.User.exists({ email: 'eve@example.com' })).toBeNull();
  });

  it('registration and Google sign-up always create user accounts', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await registerUser(app, env, mail, 'ana@example.com');
    await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-1', email: 'gia@example.com' }), intent: 'signup', acceptTerms: true });
    const roles = await env.db.models.User.find().distinct('role');
    expect(roles).toEqual(['user']);
  });

  it('cannot register over the admin email', async () => {
    const { app } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await seedAdmin(env.db.models, SECRET, ADMIN);
    const res = await request(app).post('/v1/auth/register').send(registration('admin@example.com'));
    expect(res.status).toBe(409);
    const admin = await env.db.models.User.findOne({ email: 'admin@example.com' }).lean();
    expect(admin!.role).toBe('admin');
  });

  it('Google login never signs in to or links an admin account', async () => {
    const { app } = env.makeApp();
    await seedAdmin(env.db.models, SECRET, ADMIN);
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-admin', email: 'admin@example.com' }), intent: 'login' });
    expect(res.status).toBe(403);
    const admin = await env.db.models.User.findOne({ email: 'admin@example.com' }).lean();
    expect(admin!.googleSub).toBeUndefined();
    expect(await env.db.models.Session.countDocuments()).toBe(0);
  });
});
