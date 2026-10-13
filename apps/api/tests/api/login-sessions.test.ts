import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, BFF_KEY_HEADER, CLIENT_IP_HEADER } from '@styleme/contracts';
import { hashPassword } from '../../src/services/passwords';
import {
  BASE_CONFIG,
  NEW_PASSWORD,
  PASSWORD,
  bearer,
  googleToken,
  invite,
  login,
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

const DAY = 24 * 60 * 60 * 1000;

describe('login (FR-AUTH-03)', () => {
  it('valid credentials return a session and the onboarding step; me has no password hash', async () => {
    const { app, mail } = env.makeApp();
    const user = await registerUser(app, env, mail, 'ana@example.com');
    const res = await request(app).post('/v1/auth/login').send({ email: 'ANA@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.onboardingStep).toBe('style_profile');
    const me = await request(app).get('/v1/auth/me').set(bearer(res.body.data.accessToken));
    expect(me.body.data).toMatchObject({
      id: user.id,
      email: 'ana@example.com',
      name: 'Test User',
      role: 'user',
      hasPassword: true,
    });
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('wrong password and unknown email give the same generic error', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'bo@example.com');
    const wrong = await request(app).post('/v1/auth/login').send({ email: 'bo@example.com', password: 'Wrong-Pass-1' });
    const unknown = await request(app).post('/v1/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.message).toBe(AUTH_MESSAGES.loginFailed);
  });

  it('D-90: 3 wrong passwords lock the account for 30 minutes, even for the right password; reset clears it', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'cy@example.com');
    const attempt = (password: string) =>
      request(app).post('/v1/auth/login').send({ email: 'cy@example.com', password });
    expect((await attempt('Wrong-Pass-1')).status).toBe(401);
    expect((await attempt('Wrong-Pass-2')).status).toBe(401);
    const third = await attempt('Wrong-Pass-3');
    expect(third.status).toBe(423);
    expect(third.body.error).toMatchObject({ code: 'ACCOUNT_LOCKED', message: AUTH_MESSAGES.accountLocked });
    expect(third.body.error.retryAfterSeconds).toBeGreaterThan(29 * 60);
    const { app: app2 } = env.makeApp(); // fresh IP limits
    const locked = await request(app2).post('/v1/auth/login').send({ email: 'cy@example.com', password: PASSWORD });
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');

    // The lockout expires after 30 minutes …
    await env.db.models.User.updateOne(
      { email: 'cy@example.com' },
      { $set: { 'loginSecurity.lockedUntil': new Date(Date.now() - 1000) } },
    );
    expect(
      (await request(app2).post('/v1/auth/login').send({ email: 'cy@example.com', password: PASSWORD })).status,
    ).toBe(200);

    // … and a successful password reset clears an active one.
    await env.db.models.User.updateOne(
      { email: 'cy@example.com' },
      { $set: { 'loginSecurity.lockedUntil': new Date(Date.now() + 60_000) } },
    );
    const { app: app3, mail: mail3 } = env.makeApp();
    await request(app3).post('/v1/auth/password-reset/request').send({ email: 'cy@example.com', method: 'link' });
    await request(app3)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: mail3.linkToken('cy@example.com'), newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(
      (await request(app3).post('/v1/auth/login').send({ email: 'cy@example.com', password: NEW_PASSWORD })).status,
    ).toBe(200);
  });

  it('IP rate limit: 5 attempts per minute per IP, using the BFF-forwarded client IP', async () => {
    const { app } = env.makeApp();
    const attempt = (ip: string) =>
      request(app)
        .post('/v1/auth/login')
        .set(CLIENT_IP_HEADER, ip)
        .set(BFF_KEY_HEADER, BASE_CONFIG.BFF_SHARED_SECRET)
        .send({ email: 'nobody@example.com', password: 'x' });
    for (let i = 0; i < 5; i += 1) expect((await attempt('203.0.113.1')).status).toBe(401);
    expect((await attempt('203.0.113.1')).status).toBe(429);
    expect((await attempt('203.0.113.2')).status).toBe(401);
    // A spoofed client-IP header without the BFF secret is ignored.
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

describe('sessions (D-07, D-91)', () => {
  it('Remember Me: 30-day session; without it the server limit is 24 hours', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'di@example.com');
    const short = await login(app, 'di@example.com', PASSWORD, false);
    const long = await login(app, 'di@example.com', PASSWORD, true);
    const exp = (t: string) => (jwt.decode(t) as { exp: number }).exp * 1000 - Date.now();
    expect(exp(short)).toBeGreaterThan(DAY - 60_000);
    expect(exp(short)).toBeLessThanOrEqual(DAY);
    expect(exp(long)).toBeGreaterThan(30 * DAY - 60_000);
    const sessions = await env.db.models.Session.find().sort({ createdAt: 1 }).lean();
    expect(sessions.map((s) => s.remember)).toEqual([false, true]);
    // Expiry is enforced on the server even if the token were replayed.
    await env.db.models.Session.updateMany({ remember: false }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(app).get('/v1/auth/me').set(bearer(short))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(long))).status).toBe(200);
  });

  it('logout ends only the current session; other devices stay signed in', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ed@example.com');
    const a = await login(app, 'ed@example.com');
    const b = await login(app, 'ed@example.com');
    expect((await request(app).post('/v1/auth/logout').set(bearer(a))).body.data).toEqual({ loggedOut: true });
    expect((await request(app).get('/v1/auth/me').set(bearer(a))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(b))).status).toBe(200);
  });

  it('protected endpoints reject missing, forged and unsigned tokens, and inactive users', async () => {
    const { app, mail } = env.makeApp();
    const user = await registerUser(app, env, mail, 'fi@example.com');
    const forged = jwt.sign({ sub: user.id, tv: 0, sid: 'x' }, 'another-secret-0123456789abcdefghijk', {
      algorithm: 'HS256',
    });
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: user.id, tv: 0, sid: 'x' })}.`;
    for (const headers of [{}, bearer('nope'), bearer(forged), bearer(unsigned)]) {
      expect((await request(app).get('/v1/auth/me').set(headers)).status).toBe(401);
    }
    // T-05: incrementing tokenVersion alone (session record untouched) revokes the token.
    const versioned = await login(app, 'fi@example.com');
    await env.db.models.User.updateOne({ email: 'fi@example.com' }, { $inc: { tokenVersion: 1 } });
    expect((await request(app).get('/v1/auth/me').set(bearer(versioned))).status).toBe(401);
    const token = await login(app, 'fi@example.com');
    await env.db.models.User.updateOne({ email: 'fi@example.com' }, { $set: { isActive: false } });
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
  });
});

describe('Google sign-up and login (D-88)', () => {
  it('sign-up creates a verified account without a StyleMe email code, then requires a password', async () => {
    const { app, mail } = env.makeApp();
    await invite(env, 'gu@gmail.com');
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-1', email: 'gu@gmail.com' }), intent: 'signup', acceptTerms: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: true, linked: false, onboardingStep: 'set_password' });
    expect(mail.sent).toHaveLength(0);
    const token = res.body.data.accessToken as string;
    // Until the password is set, the rest of the account is closed.
    expect((await request(app).get('/v1/profile').set(bearer(token))).body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
    const weak = await request(app)
      .post('/v1/auth/password/setup')
      .set(bearer(token))
      .send({ password: 'weakpass', confirmPassword: 'weakpass' });
    expect(weak.status).toBe(400);
    const set = await request(app)
      .post('/v1/auth/password/setup')
      .set(bearer(token))
      .send({ password: PASSWORD, confirmPassword: PASSWORD });
    expect(set.body.data).toEqual({ onboardingStep: 'style_profile' });
    const me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.body.data).toMatchObject({ emailVerified: true, googleLinked: true, hasPassword: true, city: null });
    // The new password works for email login too.
    expect((await request(app).post('/v1/auth/login').send({ email: 'gu@gmail.com', password: PASSWORD })).status).toBe(
      200,
    );
  });

  it('sign-up needs the terms accepted, an invite, and Google-verified email', async () => {
    const { app } = env.makeApp();
    const noTerms = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-2', email: 'ha@gmail.com' }), intent: 'signup' });
    expect(noTerms.status).toBe(400);
    const notInvited = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-2', email: 'ha@gmail.com' }), intent: 'signup', acceptTerms: true });
    expect(notInvited.body.error.code).toBe('NOT_INVITED');
    await invite(env, 'ha@gmail.com');
    const unverified = await request(app)
      .post('/v1/auth/google')
      .send({
        ...googleToken({ sub: 'g-2', email: 'ha@gmail.com', email_verified: false }),
        intent: 'signup',
        acceptTerms: true,
      });
    expect(unverified.status).toBe(403);
    const badNonce = await request(app)
      .post('/v1/auth/google')
      .send({
        ...googleToken({ sub: 'g-2', email: 'ha@gmail.com' }),
        nonce: 'a-different-nonce-123',
        intent: 'signup',
        acceptTerms: true,
      });
    expect(badNonce.status).toBe(401);
    expect(await env.db.models.User.countDocuments()).toBe(0);
  });

  it('sign-up with an email that already has an account is refused with a log-in hint', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'io@gmail.com');
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-3', email: 'io@gmail.com' }), intent: 'signup', acceptTerms: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GOOGLE_ACCOUNT_EXISTS');
  });

  it('login with Google links a verified existing account and keeps its data', async () => {
    const { app, mail } = env.makeApp();
    const user = await registerUser(app, env, mail, 'jo@gmail.com');
    const token = await login(app, 'jo@gmail.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });

    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-4', email: 'jo@gmail.com' }), intent: 'login' });
    expect(res.body.data).toMatchObject({ created: false, linked: true });
    const stored = await env.db.models.User.findById(user.id).lean();
    expect(stored?.googleSub).toBe('g-4');
    expect(await env.db.models.Profile.countDocuments({ userId: stored!._id })).toBe(1);
    // Existing sessions and the password survive linking a verified account.
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(200);
    // Second login finds the account by Google ID even after an email change.
    await env.db.models.User.updateOne({ _id: user.id }, { $set: { email: 'jo.new@example.com' } });
    const again = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-4', email: 'jo@gmail.com' }), intent: 'login' });
    expect(again.body.data).toMatchObject({ linked: false });
  });

  it('linking an unverified account discards the pre-registered password and sessions (takeover protection)', async () => {
    const { app } = env.makeApp();
    // An unverified account from before sign-ups waited for the code: someone registered this email
    // but never verified it.
    await env.db.models.User.create({
      email: 'ka@gmail.com',
      name: 'Squatter',
      role: 'user',
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: null,
    });
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-5', email: 'ka@gmail.com' }), intent: 'login' });
    expect(res.body.data).toMatchObject({ linked: true, onboardingStep: 'set_password' });
    const stored = await env.db.models.User.findOne({ email: 'ka@gmail.com' }).lean();
    expect(stored?.passwordHash).toBeNull();
    expect(stored?.emailVerifiedAt).toBeInstanceOf(Date);
    // The pre-registration password no longer works.
    expect((await request(app).post('/v1/auth/login').send({ email: 'ka@gmail.com', password: PASSWORD })).status).toBe(
      401,
    );
    expect(await env.db.models.AuthChallenge.countDocuments({ userId: stored!._id })).toBe(0);
  });

  it('one Google identity cannot be linked to two accounts; unknown Google login asks to sign up', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'la@gmail.com');
    await registerUser(app, env, mail, 'ma@gmail.com');
    await env.db.models.User.updateOne({ email: 'la@gmail.com' }, { $set: { googleSub: 'g-6' } });
    // A different Google account claiming ma@'s email can't hijack la@'s Google link…
    await env.db.models.User.updateOne({ email: 'ma@gmail.com' }, { $set: { googleSub: 'g-7' } });
    const other = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-8', email: 'ma@gmail.com' }), intent: 'login' });
    expect(other.status).toBe(403);
    // … and the database refuses a second account with the same Google ID.
    await expect(
      env.db.models.User.updateOne({ email: 'ma@gmail.com' }, { $set: { googleSub: 'g-6' } }),
    ).rejects.toThrow(/duplicate key/);
    const unknown = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-9', email: 'new@gmail.com' }), intent: 'login' });
    expect(unknown.body.error.code).toBe('GOOGLE_NO_ACCOUNT');
  });

  it('without a configured Google client the endpoint reports PROVIDER_NOT_CONFIGURED', async () => {
    const { app } = env.makeApp({}, { google: null });
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-x', email: 'x@gmail.com' }), intent: 'login' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});
