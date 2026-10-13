import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, LEGAL_VERSIONS } from '@styleme/contracts';
import { PASSWORD, bearer, invite, registerPending, registration, startTestEnv, type TestEnv } from '../helpers';

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

describe('registration (FR-AUTH-01, D-87)', () => {
  it('creates an unverified account, records consent and sends a code and a link', async () => {
    const { app, mail } = env.makeApp();
    await invite(env, 'ana@example.com');
    const res = await request(app)
      .post('/v1/auth/register')
      .send(registration('Ana@Example.com', { phone: '098765 43210', marketingOptIn: true }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'ana@example.com', verificationEmailSent: true });
    expect(res.body.data.pendingToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const user = await env.db.models.User.findOne({ email: 'ana@example.com' }).lean();
    expect(user?.emailVerifiedAt).toBeNull();
    expect(user?.city).toBe('mumbai');
    expect(user?.phone).toMatchObject({ e164: '+919876543210', verifiedAt: null });
    expect(user?.consent).toMatchObject({
      termsVersion: LEGAL_VERSIONS.terms,
      privacyVersion: LEGAL_VERSIONS.privacy,
      marketingOptIn: true,
    });
    expect(user?.consent?.termsAcceptedAt).toBeInstanceOf(Date);
    expect(user?.passwordHash?.startsWith('$argon2id$')).toBe(true);

    const email = mail.last('ana@example.com');
    expect(email.text).toMatch(/\b\d{6}\b/);
    expect(email.text).toContain('http://localhost:3000/verify-email/link#token=');
    // Only hashes are stored.
    const challenge = await env.db.models.AuthChallenge.findOne({ purpose: 'email_verification' }).lean();
    expect(JSON.stringify(challenge)).not.toContain(mail.otp('ana@example.com'));
    expect(JSON.stringify(challenge)).not.toContain(mail.linkToken('ana@example.com'));
  });

  it('rejects missing and invalid fields, password-policy failures and a mismatched confirmation', async () => {
    await invite(env, 'bo@example.com');
    const bad: Record<string, unknown>[] = [
      { fullName: '' },
      { email: 'not-an-email' },
      { city: '' },
      { city: 'atlantis' },
      { phone: '12345' },
      { password: 'short1!A', confirmPassword: 'short1!B' },
      { password: 'alllowercase1!', confirmPassword: 'alllowercase1!' },
      { password: 'ALLUPPERCASE1!', confirmPassword: 'ALLUPPERCASE1!' },
      { password: 'NoNumbers!!', confirmPassword: 'NoNumbers!!' },
      { password: 'NoSpecial123', confirmPassword: 'NoSpecial123' },
      { password: 'Sh0rt!', confirmPassword: 'Sh0rt!' },
      { acceptTerms: false },
      { acceptTerms: undefined },
    ];
    for (const change of bad) {
      // A fresh app per attempt: registration is rate-limited to 3 per minute per IP before validation.
      const { app } = env.makeApp();
      const res = await request(app).post('/v1/auth/register').send(registration('bo@example.com', change));
      expect(res.status, JSON.stringify(change)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect(await env.db.models.User.countDocuments()).toBe(0);
  });

  it('a duplicate email gets EMAIL_ALREADY_REGISTERED (with a log-in hint)', async () => {
    const { app } = env.makeApp();
    await registerPending(app, env, 'cy@example.com');
    const res = await request(app).post('/v1/auth/register').send(registration('CY@example.com'));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'EMAIL_ALREADY_REGISTERED', message: AUTH_MESSAGES.emailAlreadyRegistered });
  });

  it('closed beta: an uninvited email is refused; public sign-up needs no invite', async () => {
    const { app } = env.makeApp();
    const refused = await request(app).post('/v1/auth/register').send(registration('di@example.com'));
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('NOT_INVITED');
    const { app: open } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    expect((await request(open).post('/v1/auth/register').send(registration('di@example.com'))).status).toBe(201);
  });

  it('reports when the verification email could not be sent, without failing the account', async () => {
    const { app, mail } = env.makeApp();
    await invite(env, 'ed@example.com');
    mail.failNext = true;
    const res = await request(app).post('/v1/auth/register').send(registration('ed@example.com'));
    expect(res.status).toBe(201);
    expect(res.body.data.verificationEmailSent).toBe(false);
  });
});

describe('email verification (FR-AUTH-16, D-89)', () => {
  it('a correct code verifies; with the pending token it opens a session and points to onboarding', async () => {
    const { app, mail } = env.makeApp();
    const { pendingToken } = await registerPending(app, env, 'fi@example.com', { rememberMe: true });
    const res = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'fi@example.com', otp: mail.otp('fi@example.com'), pendingToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ verified: true, email: 'fi@example.com', onboardingStep: 'style_profile' });
    const me = await request(app).get('/v1/auth/me').set(bearer(res.body.data.accessToken));
    expect(me.body.data).toMatchObject({ emailVerified: true, onboardingStep: 'style_profile', city: 'mumbai' });
    const session = await env.db.models.Session.findOne().lean();
    expect(session?.remember).toBe(true);
  });

  it('verifying without the pending token (another device) verifies but opens no session', async () => {
    const { app, mail } = env.makeApp();
    await registerPending(app, env, 'gu@example.com');
    const res = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'gu@example.com', otp: mail.otp('gu@example.com') });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true, email: 'gu@example.com' });
  });

  it('a code is single-use; a wrong code is rejected; 3 wrong codes lock verification for 30 minutes', async () => {
    const { app, mail } = env.makeApp();
    await registerPending(app, env, 'ha@example.com');
    const otp = mail.otp('ha@example.com');
    const wrong = otp === '000000' ? '111111' : '000000';
    const send = (code: string) =>
      request(app).post('/v1/auth/email-verification/otp').send({ email: 'ha@example.com', otp: code });

    const first = await send(wrong);
    expect(first.status).toBe(400);
    expect(first.body.error.code).toBe('OTP_INVALID');
    expect((await send(wrong)).body.error.code).toBe('OTP_INVALID');
    const third = await send(wrong);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('OTP_LOCKED');
    expect(third.body.error.retryAfterSeconds).toBeGreaterThan(29 * 60);
    // Even the right code is refused during the lockout.
    expect((await send(otp)).body.error.code).toBe('OTP_LOCKED');
  });

  it('an expired code is rejected', async () => {
    const { app, mail } = env.makeApp();
    await registerPending(app, env, 'io@example.com');
    await env.db.models.AuthChallenge.updateOne({}, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });
    const res = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'io@example.com', otp: mail.otp('io@example.com') });
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('a link verifies once; reused, expired and unknown links are rejected', async () => {
    const { app, mail } = env.makeApp();
    const { pendingToken } = await registerPending(app, env, 'jo@example.com');
    const token = mail.linkToken('jo@example.com');
    const ok = await request(app).post('/v1/auth/email-verification/link').send({ token, pendingToken });
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toEqual(expect.any(String));
    const reused = await request(app).post('/v1/auth/email-verification/link').send({ token });
    expect(reused.body.error.code).toBe('LINK_INVALID');
    const unknown = await request(app)
      .post('/v1/auth/email-verification/link')
      .send({ token: 'x'.repeat(43) });
    expect(unknown.body.error.code).toBe('LINK_INVALID');

    await registerPending(app, env, 'ka@example.com');
    const challenge = await env.db.models.AuthChallenge.findOne({ purpose: 'email_verification' }).lean();
    await env.db.models.AuthChallenge.updateOne(
      { _id: challenge!._id },
      { $set: { linkExpiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await request(app)
      .post('/v1/auth/email-verification/link')
      .send({ token: mail.linkToken('ka@example.com') });
    expect(expired.body.error.code).toBe('LINK_INVALID');
  });

  it('resend: 30-second cooldown, then at most 6 sends per hour; a new code invalidates the old one', async () => {
    const { app, mail } = env.makeApp();
    const { pendingToken } = await registerPending(app, env, 'la@example.com');
    const firstOtp = mail.otp('la@example.com');
    const resend = () =>
      request(app).post('/v1/auth/email-verification/resend').send({ email: 'la@example.com', pendingToken });

    const tooSoon = await resend();
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('RESEND_COOLDOWN');

    const challengeId = (await env.db.models.AuthChallenge.findOne().lean())!._id;
    const age = async () => {
      const c = await env.db.models.AuthChallenge.findById(challengeId).lean();
      const shifted = (c!.sentAt as unknown as Date[]).map((d) => new Date(new Date(d).getTime() - 31_000));
      await env.db.models.AuthChallenge.updateOne({ _id: challengeId }, { $set: { sentAt: shifted } });
    };
    for (let i = 0; i < 5; i += 1) {
      await age();
      expect((await resend()).status).toBe(202);
    }
    expect(mail.count('la@example.com')).toBe(6);
    await age();
    const limited = await resend();
    expect(limited.body.error.code).toBe('RESEND_LIMIT');

    // Only the latest code works.
    const old = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'la@example.com', otp: firstOtp });
    if (firstOtp !== mail.otp('la@example.com')) expect(old.body.error.code).toBe('OTP_INVALID');
  });

  it('recovery by email alone gets a generic response for registered, verified and unknown emails', async () => {
    const { app } = env.makeApp();
    await registerPending(app, env, 'ma@example.com');
    const responses = await Promise.all(
      ['ma@example.com', 'nobody@example.com'].map((email) =>
        request(app).post('/v1/auth/email-verification/resend').send({ email }),
      ),
    );
    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ success: true, data: { accepted: true } });
    }
  });

  it('changing the email during verification invalidates the old code and link and sends new ones', async () => {
    const { app, mail } = env.makeApp();
    const { pendingToken } = await registerPending(app, env, 'na@example.com');
    const oldOtp = mail.otp('na@example.com');
    const oldLink = mail.linkToken('na@example.com');
    await invite(env, 'na.new@example.com');
    await env.db.models.AuthChallenge.updateMany({}, { $set: { sentAt: [new Date(Date.now() - 60_000)] } });

    const changed = await request(app)
      .put('/v1/auth/email-verification/email')
      .send({ pendingToken, newEmail: 'na.new@example.com' });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ email: 'na.new@example.com', verificationEmailSent: true });
    expect((await request(app).post('/v1/auth/email-verification/link').send({ token: oldLink })).body.error.code).toBe(
      'LINK_INVALID',
    );
    const oldCode = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'na.new@example.com', otp: oldOtp });
    if (oldOtp !== mail.otp('na.new@example.com')) expect(oldCode.body.error.code).toBe('OTP_INVALID');

    const user = await env.db.models.User.findOne({ email: 'na.new@example.com' }).lean();
    expect(user?.emailVerifiedAt).toBeNull();
    const ok = await request(app)
      .post('/v1/auth/email-verification/otp')
      .send({ email: 'na.new@example.com', otp: mail.otp('na.new@example.com'), pendingToken });
    expect(ok.status).toBe(200);
  });

  it('the pending token is required to change the email and identifies the pending registration', async () => {
    const { app } = env.makeApp();
    const { pendingToken } = await registerPending(app, env, 'oa@example.com');
    const info = await request(app).post('/v1/auth/email-verification/pending').send({ pendingToken });
    expect(info.body.data).toMatchObject({ email: 'oa@example.com' });
    const forged = await request(app)
      .put('/v1/auth/email-verification/email')
      .send({ pendingToken: 'y'.repeat(43), newEmail: 'attacker@example.com' });
    expect(forged.status).toBe(404);
  });

  it('logging in before verifying is blocked with EMAIL_NOT_VERIFIED and no session', async () => {
    const { app } = env.makeApp();
    await registerPending(app, env, 'pa@example.com');
    const res = await request(app).post('/v1/auth/login').send({ email: 'pa@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(res.body.data).toBeUndefined();
    expect(await env.db.models.Session.countDocuments()).toBe(0);
  });
});
