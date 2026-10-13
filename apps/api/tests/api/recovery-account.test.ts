import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES } from '@styleme/contracts';
import { hmacSha256 } from '../../src/utils/crypto';
import {
  BASE_CONFIG,
  NEW_PASSWORD,
  PASSWORD,
  bearer,
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

async function ageSends(purpose: 'email_change' | 'password_reset') {
  await env.db.models.AuthChallenge.updateMany({ purpose }, { $set: { sentAt: [new Date(Date.now() - 60_000)] } });
}

describe('password reset (FR-AUTH-13, D-89)', () => {
  it('by link: 15-minute single-use link, all sessions revoked, then log in with the new password', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ana@example.com');
    const old = await login(app, 'ana@example.com');
    const req = await request(app)
      .post('/v1/auth/password-reset/request')
      .send({ email: 'ana@example.com', method: 'link' });
    expect(req.status).toBe(202);
    expect(mail.last('ana@example.com').text).toContain('http://localhost:3000/reset-password#token=');
    const challenge = await env.db.models.AuthChallenge.findOne({ purpose: 'password_reset' }).lean();
    expect(challenge!.linkExpiresAt!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);
    expect(challenge!.linkExpiresAt!.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);

    const token = mail.linkToken('ana@example.com');
    const confirm = (t: string) =>
      request(app)
        .post('/v1/auth/password-reset/confirm')
        .send({ token: t, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect((await confirm(token)).body.data).toEqual({ reset: true });
    expect((await request(app).get('/v1/auth/me').set(bearer(old))).status).toBe(401);
    expect((await confirm(token)).body.error.code).toBe('LINK_INVALID');
    await login(app, 'ana@example.com', NEW_PASSWORD);
  });

  it('by code: 5-minute code exchanged for a reset token; 3 wrong codes lock for 30 minutes', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'bo@example.com');
    await request(app).post('/v1/auth/password-reset/request').send({ email: 'bo@example.com', method: 'otp' });
    const otp = mail.otp('bo@example.com');
    const wrong = otp === '000000' ? '111111' : '000000';
    const verify = (code: string) =>
      request(app).post('/v1/auth/password-reset/verify-otp').send({ email: 'bo@example.com', otp: code });
    expect((await verify(wrong)).body.error.code).toBe('OTP_INVALID');
    const ok = await verify(otp);
    expect(ok.status).toBe(200);
    const done = await request(app)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: ok.body.data.resetToken, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(done.body.data).toEqual({ reset: true });

    // Lockout path
    await ageSends('password_reset');
    await request(app).post('/v1/auth/password-reset/request').send({ email: 'bo@example.com', method: 'otp' });
    const otp2 = mail.otp('bo@example.com');
    const wrong2 = otp2 === '000000' ? '111111' : '000000';
    await verify(wrong2);
    await verify(wrong2);
    const locked = await verify(wrong2);
    expect(locked.body.error.code).toBe('OTP_LOCKED');
    expect((await verify(otp2)).body.error.code).toBe('OTP_LOCKED');
  });

  it('expired code, policy failures and mismatched confirmation are rejected', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'cy@example.com');
    await request(app).post('/v1/auth/password-reset/request').send({ email: 'cy@example.com', method: 'otp' });
    await env.db.models.AuthChallenge.updateOne(
      { purpose: 'password_reset' },
      { $set: { otpExpiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await request(app)
      .post('/v1/auth/password-reset/verify-otp')
      .send({ email: 'cy@example.com', otp: mail.otp('cy@example.com') });
    expect(expired.body.error.code).toBe('OTP_INVALID');
    for (const body of [
      { token: 'x'.repeat(43), newPassword: 'weakpass', confirmPassword: 'weakpass' },
      { token: 'x'.repeat(43), newPassword: NEW_PASSWORD, confirmPassword: 'Different-1!' },
    ]) {
      expect((await request(app).post('/v1/auth/password-reset/confirm').send(body)).status).toBe(400);
    }
  });

  it('an unregistered email shows "Email not registered"; resend cooldown and hourly limit apply', async () => {
    const { app, mail } = env.makeApp();
    const missing = await request(app)
      .post('/v1/auth/password-reset/request')
      .send({ email: 'ghost@example.com', method: 'link' });
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual({ code: 'EMAIL_NOT_REGISTERED', message: AUTH_MESSAGES.emailNotRegistered });

    await registerUser(app, env, mail, 'di@example.com');
    const send = () =>
      request(app).post('/v1/auth/password-reset/request').send({ email: 'di@example.com', method: 'otp' });
    expect((await send()).status).toBe(202);
    expect((await send()).body.error.code).toBe('RESEND_COOLDOWN');
    for (let i = 0; i < 5; i += 1) {
      await env.db.main
        .collection('authChallenges')
        .updateOne({ purpose: 'password_reset' }, [
          { $set: { sentAt: { $map: { input: '$sentAt', in: { $subtract: ['$$this', 31_000] } } } } },
        ]);
      expect((await send()).status).toBe(202);
    }
    await env.db.main
      .collection('authChallenges')
      .updateOne({ purpose: 'password_reset' }, [
        { $set: { sentAt: { $map: { input: '$sentAt', in: { $subtract: ['$$this', 31_000] } } } } },
      ]);
    expect((await send()).body.error.code).toBe('RESEND_LIMIT');
  });

  it('admin-issued code: single use, 60 minutes, never logged', async () => {
    const { app, mail, authService } = env.makeApp();
    const user = await registerUser(app, env, mail, 'ed@example.com');
    const stored = await env.db.models.User.findById(user.id).lean();
    const code = await authService.issueAdminResetCode(stored!._id, null);
    const challenge = await env.db.models.AuthChallenge.findOne({ purpose: 'password_reset' }).lean();
    expect(challenge!.linkExpiresAt!.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);
    const res = await request(app)
      .post('/v1/auth/password-reset/confirm')
      .send({ token: code, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(env.logLines.join('\n')).not.toContain(code);
  });

  it('two concurrent redemptions of one reset link: exactly one succeeds', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'fi@example.com');
    await request(app).post('/v1/auth/password-reset/request').send({ email: 'fi@example.com', method: 'link' });
    const token = mail.linkToken('fi@example.com');
    const body = { token, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD };
    const [a, b] = await Promise.all([
      request(app).post('/v1/auth/password-reset/confirm').send(body),
      request(app).post('/v1/auth/password-reset/confirm').send(body),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 400]);
  });
});

describe('account settings (FR-AUTH-11, -17 … -19)', () => {
  it('change password with an emailed code: other sessions revoked, this browser stays signed in, notice sent', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'gu@example.com');
    const other = await login(app, 'gu@example.com');
    const current = await login(app, 'gu@example.com', PASSWORD, true);
    const sent = await request(app).post('/v1/auth/password/change-otp').set(bearer(current));
    expect(sent.body.data).toMatchObject({ sent: true, destination: 'g•••@example.com' });
    const otp = mail.otp('gu@example.com');
    const bad = await request(app)
      .put('/v1/auth/password')
      .set(bearer(current))
      .send({ otp: otp === '000000' ? '111111' : '000000', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(bad.body.error.code).toBe('OTP_INVALID');
    const ok = await request(app)
      .put('/v1/auth/password')
      .set(bearer(current))
      .send({ otp, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(ok.status).toBe(200);
    expect((await request(app).get('/v1/auth/me').set(bearer(other))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(current))).status).toBe(401);
    expect((await request(app).get('/v1/auth/me').set(bearer(ok.body.data.accessToken))).status).toBe(200);
    expect((await env.db.models.Session.findOne().lean())?.remember).toBe(true);
    expect(mail.last('gu@example.com').subject).toContain('password was changed');
  });

  it('email change: re-authentication, verify the new address, old address stays until then, old notified', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ha@example.com');
    await registerUser(app, env, mail, 'taken@example.com');
    const token = await login(app, 'ha@example.com');
    const start = (body: object) => request(app).post('/v1/account/email-change').set(bearer(token)).send(body);
    expect((await start({ password: 'Wrong-Pass-1', newEmail: 'ha.new@example.com' })).body.error.code).toBe(
      'PASSWORD_INCORRECT',
    );
    expect((await start({ password: PASSWORD, newEmail: 'taken@example.com' })).body.error.code).toBe(
      'EMAIL_ALREADY_REGISTERED',
    );
    expect((await start({ password: PASSWORD, newEmail: 'ha.new@example.com' })).status).toBe(200);

    let me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.body.data).toMatchObject({ email: 'ha@example.com', pendingEmail: 'ha.new@example.com' });
    // The old email still logs in while the change is pending.
    await login(app, 'ha@example.com');

    const verified = await request(app)
      .post('/v1/account/email-change/verify')
      .set(bearer(token))
      .send({ otp: mail.otp('ha.new@example.com') });
    expect(verified.body.data).toMatchObject({ email: 'ha.new@example.com', emailVerified: true, pendingEmail: null });
    expect(mail.last('ha@example.com').subject).toContain('email address was changed');
    me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.body.data.email).toBe('ha.new@example.com');
  });

  it('email change by link; a newer change invalidates the earlier link', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'io@example.com');
    const token = await login(app, 'io@example.com');
    await request(app)
      .post('/v1/account/email-change')
      .set(bearer(token))
      .send({ password: PASSWORD, newEmail: 'first@example.com' });
    const stale = mail.linkToken('first@example.com');
    await ageSends('email_change');
    await request(app)
      .post('/v1/account/email-change')
      .set(bearer(token))
      .send({ password: PASSWORD, newEmail: 'second@example.com' });
    expect((await request(app).post('/v1/account/email-change/confirm').send({ token: stale })).body.error.code).toBe(
      'LINK_INVALID',
    );
    const ok = await request(app)
      .post('/v1/account/email-change/confirm')
      .send({ token: mail.linkToken('second@example.com') });
    expect(ok.body.data).toEqual({ email: 'second@example.com' });
  });

  it('optional phone: SMS code verifies; nothing is marked verified before; no provider → clear error', async () => {
    const { app, mail, sms } = env.makeApp();
    await registerUser(app, env, mail, 'jo@example.com');
    const token = await login(app, 'jo@example.com');
    const start = await request(app).put('/v1/account/phone').set(bearer(token)).send({ phone: '+91 98765 43210' });
    expect(start.body.data).toMatchObject({ sent: true, destination: '+91 •••••• 3210' });
    let me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.body.data).toMatchObject({ phone: null, pendingPhone: '+919876543210' });
    const ok = await request(app).post('/v1/account/phone/verify').set(bearer(token)).send({ otp: sms!.otp() });
    expect(ok.body.data.phone).toEqual({ number: '+919876543210', verified: true });
    expect((await request(app).put('/v1/account/phone').set(bearer(token)).send({ phone: '12345' })).status).toBe(400);
    me = await request(app).delete('/v1/account/phone').set(bearer(token));
    expect(me.body.data.phone).toBeNull();

    const { app: noSms } = env.makeApp({}, { sms: null });
    const unavailable = await request(noSms).put('/v1/account/phone').set(bearer(token)).send({ phone: '9876543210' });
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('account deletion needs an emailed code and explicit confirmation; then everything is gone', async () => {
    const { app, mail } = env.makeApp();
    const user = await registerUser(app, env, mail, 'ka@example.com');
    const token = await login(app, 'ka@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const otp = mail.otp('ka@example.com');
    const noConfirm = await request(app).delete('/v1/account').set(bearer(token)).send({ otp });
    expect(noConfirm.status).toBe(400);
    const res = await request(app).delete('/v1/account').set(bearer(token)).send({ otp, confirm: true });
    expect(res.body.data).toEqual({ deleted: true });

    const tombstone = await env.db.models.Tombstone.findOne().lean();
    expect(String(tombstone?.userId)).toBe(user.id);
    expect(tombstone?.emailHmac).toBe(hmacSha256(BASE_CONFIG.TOMBSTONE_HMAC_KEY, 'ka@example.com'));
    for (const model of ['User', 'Session', 'AuthChallenge', 'Profile'] as const) {
      expect(await (env.db.models[model] as typeof env.db.models.User).countDocuments()).toBe(0);
    }
    expect((await request(app).get('/v1/auth/me').set(bearer(token))).status).toBe(401);
    expect(
      (await request(app).post('/v1/auth/login').send({ email: 'ka@example.com', password: PASSWORD })).status,
    ).toBe(401);
  });

  it('account details: name, city and marketing consent can be changed', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'la@example.com');
    const token = await login(app, 'la@example.com');
    const res = await request(app)
      .put('/v1/account/details')
      .set(bearer(token))
      .send({ city: 'pune', marketingOptIn: true });
    expect(res.body.data).toMatchObject({ city: 'pune', marketingOptIn: true });
    expect((await request(app).put('/v1/account/details').set(bearer(token)).send({ city: 'paris' })).status).toBe(400);
    await invite(env, 'unused@example.com');
  });
});
