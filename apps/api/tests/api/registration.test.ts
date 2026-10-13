import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUTH_MESSAGES, LEGAL_VERSIONS } from '@styleme/contracts';
import { hashPassword } from '../../src/services/passwords';
import {
  NEW_PASSWORD,
  PASSWORD,
  bearer,
  googleToken,
  invite,
  registerPending,
  registration,
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

const verify = (app: Parameters<typeof request>[0], body: Record<string, unknown>) =>
  request(app).post('/v1/auth/email-verification/otp').send(body);

/** Moves every recorded send of the email-verification challenge back by `ms` (cooldown tests). */
async function ageSends(ms = 31_000) {
  const challenges = await env.db.models.AuthChallenge.find({ purpose: 'email_verification' }).lean();
  for (const c of challenges) {
    const shifted = (c.sentAt as unknown as Date[]).map((d) => new Date(new Date(d).getTime() - ms));
    await env.db.models.AuthChallenge.updateOne({ _id: c._id }, { $set: { sentAt: shifted } });
  }
}

describe('registration starts a pending sign-up; no account yet (FR-AUTH-01)', () => {
  it('stores the details with a password hash, emails a 6-digit code, and creates no user', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const res = await request(app)
      .post('/v1/auth/register')
      .send(registration('Ana@Example.com', { phone: '098765 43210', marketingOptIn: true }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'ana@example.com', verificationEmailSent: true });
    expect(res.body.data.pendingToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    expect(await env.db.models.User.countDocuments()).toBe(0);
    const pending = await env.db.models.PendingRegistration.findOne({ email: 'ana@example.com' }).lean();
    expect(pending).toMatchObject({ name: 'Test User', city: 'mumbai', phone: '+919876543210', marketingOptIn: true });
    expect(pending?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.stringify(pending)).not.toContain(PASSWORD);

    const email = mail.last('ana@example.com');
    expect(email.subject).toBe('Verify your StyleMe email address');
    const otp = mail.otp('ana@example.com');
    expect(email.text).toContain('This code expires in 5 minutes. Do not share this code with anyone.');
    expect(email.html).toContain(otp);
    // Sign-up codes come without a verification link.
    expect(email.text).not.toContain('#token=');
    // Only hashes are stored; the response never contains the code.
    const challenge = await env.db.models.AuthChallenge.findOne({ purpose: 'email_verification' }).lean();
    expect(JSON.stringify(challenge)).not.toContain(otp);
    expect(JSON.stringify(res.body)).not.toContain(otp);
    expect(String(challenge?.userId)).toBe(String(pending?._id));
  });

  it('escapes the name in the HTML email', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await request(app)
      .post('/v1/auth/register')
      .send(registration('x@example.com', { fullName: '<b>Eve</b> & Co' }));
    expect(mail.last('x@example.com').html).toContain('Hello &lt;b&gt;Eve&lt;/b&gt; &amp; Co,');
  });

  it('rejects missing and invalid fields, password-policy failures, a mismatch and missing terms', async () => {
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
      const { app } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
      const res = await request(app).post('/v1/auth/register').send(registration('bo@example.com', change));
      expect(res.status, JSON.stringify(change)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect(await env.db.models.PendingRegistration.countDocuments()).toBe(0);
    expect(await env.db.models.User.countDocuments()).toBe(0);
  });

  it('an email that already has an account gets EMAIL_ALREADY_REGISTERED (with a log-in hint)', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'cy@example.com');
    await verify(app, { email: 'cy@example.com', otp: mail.otp('cy@example.com'), pendingToken });
    const res = await request(app).post('/v1/auth/register').send(registration('CY@example.com'));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({ code: 'EMAIL_ALREADY_REGISTERED', message: AUTH_MESSAGES.emailAlreadyRegistered });
  });

  it('public sign-up needs no invite; with PUBLIC_SIGNUP_ENABLED=false an uninvited email is refused', async () => {
    const { app: closed } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: false });
    const refused = await request(closed).post('/v1/auth/register').send(registration('di@example.com'));
    expect(refused.status).toBe(403);
    expect(refused.body.error.code).toBe('NOT_INVITED');
    await invite(env, 'di@example.com');
    expect((await request(closed).post('/v1/auth/register').send(registration('di@example.com'))).status).toBe(201);
    const { app: open } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    expect((await request(open).post('/v1/auth/register').send(registration('dj@example.com'))).status).toBe(201);
  });

  it('a delivery failure is reported (no false success) and creates no account', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    mail.failNext = true;
    const res = await request(app).post('/v1/auth/register').send(registration('ed@example.com'));
    expect(res.status).toBe(201);
    expect(res.body.data.verificationEmailSent).toBe(false);
    expect(await env.db.models.User.countDocuments()).toBe(0);
    expect(env.logLines.join('\n')).toContain('verification_email_failed');
  });

  it('registering again replaces the pending details, respects the cooldown, and retires the old browser', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const first = await registerPending(app, env, 'fa@example.com');
    const tooSoon = await request(app).post('/v1/auth/register').send(registration('fa@example.com'));
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('RESEND_COOLDOWN');

    await ageSends();
    const second = await request(app)
      .post('/v1/auth/register')
      .send(registration('fa@example.com', { password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD }));
    expect(second.status).toBe(201);
    expect(await env.db.models.PendingRegistration.countDocuments()).toBe(1);
    // The first browser's token no longer belongs to this registration.
    const old = await verify(app, {
      email: 'fa@example.com',
      otp: mail.otp('fa@example.com'),
      pendingToken: first.pendingToken,
    });
    expect(old.status).toBe(404);
    const ok = await verify(app, {
      email: 'fa@example.com',
      otp: mail.otp('fa@example.com'),
      pendingToken: second.body.data.pendingToken,
    });
    expect(ok.status).toBe(200);
    expect(
      (await request(app).post('/v1/auth/login').send({ email: 'fa@example.com', password: NEW_PASSWORD })).status,
    ).toBe(200);
  });
});

describe('verifying the code creates the account (FR-AUTH-16, D-89)', () => {
  it('a correct code creates a verified account with the sign-up details and opens a session', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'fi@example.com', {
      rememberMe: true,
      phone: '9876543210',
    });
    const pendingId = (await env.db.models.PendingRegistration.findOne().lean())!._id;
    const res = await verify(app, { email: 'fi@example.com', otp: mail.otp('fi@example.com'), pendingToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ verified: true, email: 'fi@example.com', onboardingStep: 'style_profile' });

    const user = await env.db.models.User.findOne({ email: 'fi@example.com' }).lean();
    expect(String(user?._id)).toBe(String(pendingId));
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user?.passwordHash?.startsWith('$argon2id$')).toBe(true);
    expect(user?.phone).toMatchObject({ e164: '+919876543210', verifiedAt: null });
    expect(user?.consent).toMatchObject({ termsVersion: LEGAL_VERSIONS.terms, privacyVersion: LEGAL_VERSIONS.privacy });
    expect(user?.consent?.termsAcceptedAt).toBeInstanceOf(Date);
    // Pending data and the challenge are gone.
    expect(await env.db.models.PendingRegistration.countDocuments()).toBe(0);
    expect(await env.db.models.AuthChallenge.countDocuments()).toBe(0);

    const me = await request(app).get('/v1/auth/me').set(bearer(res.body.data.accessToken));
    expect(me.body.data).toMatchObject({ emailVerified: true, onboardingStep: 'style_profile', city: 'mumbai' });
    expect((await env.db.models.Session.findOne().lean())?.remember).toBe(true);
  });

  it('end to end: register → verify → log out → log in → log in again after logging out', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'e2e@example.com');
    const verified = await verify(app, { email: 'e2e@example.com', otp: mail.otp('e2e@example.com'), pendingToken });
    const first = verified.body.data.accessToken as string;
    expect((await request(app).post('/v1/auth/logout').set(bearer(first))).status).toBe(200);
    expect((await request(app).get('/v1/auth/me').set(bearer(first))).status).toBe(401);

    const wrong = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'e2e@example.com', password: 'Wrong-Pass-1' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toBe(AUTH_MESSAGES.loginFailed);

    const login = await request(app).post('/v1/auth/login').send({ email: 'e2e@example.com', password: PASSWORD });
    expect(login.status).toBe(200);
    const second = login.body.data.accessToken as string;
    expect((await request(app).get('/v1/auth/me').set(bearer(second))).body.data.email).toBe('e2e@example.com');
    await request(app).post('/v1/auth/logout').set(bearer(second));
    const again = await request(app).post('/v1/auth/login').send({ email: 'e2e@example.com', password: PASSWORD });
    expect(again.status).toBe(200);
  });

  it('cannot be bypassed: without the registering browser’s token no code is checked and no account appears', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await registerPending(app, env, 'gu@example.com');
    const otp = mail.otp('gu@example.com');
    for (const body of [
      { email: 'gu@example.com', otp },
      { email: 'gu@example.com', otp, pendingToken: 'y'.repeat(43) },
    ]) {
      const res = await verify(app, body);
      expect(res.status).toBe(404);
    }
    // Logging in before verifying never opens a session.
    const login = await request(app).post('/v1/auth/login').send({ email: 'gu@example.com', password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('REGISTRATION_PENDING');
    expect(login.body.data).toBeUndefined();
    const wrongPassword = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'gu@example.com', password: 'Wrong-Pass-1' });
    expect(wrongPassword.body.error.code).toBe('UNAUTHENTICATED');
    expect(await env.db.models.User.countDocuments()).toBe(0);
    expect(await env.db.models.Session.countDocuments()).toBe(0);
    // Requests without a code reach no account either.
    expect(
      (
        await request(app)
          .post('/v1/auth/email-verification/link')
          .send({ token: 'x'.repeat(43) })
      ).status,
    ).toBe(400);
    // Wrong-token attempts did not use up the code.
    expect((await env.db.models.AuthChallenge.findOne().lean())?.failedAttempts).toBe(0);
  });

  it('a wrong code is rejected; 3 wrong codes lock verification for 30 minutes', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'ha@example.com');
    const otp = mail.otp('ha@example.com');
    const wrong = otp === '000000' ? '111111' : '000000';
    const send = (code: string) => verify(app, { email: 'ha@example.com', otp: code, pendingToken });

    const first = await send(wrong);
    expect(first.status).toBe(400);
    expect(first.body.error.code).toBe('OTP_INVALID');
    expect((await send(wrong)).body.error.code).toBe('OTP_INVALID');
    const third = await send(wrong);
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('OTP_LOCKED');
    expect(third.body.error.retryAfterSeconds).toBeGreaterThan(29 * 60);
    expect((await send(otp)).body.error.code).toBe('OTP_LOCKED');
    expect(await env.db.models.User.countDocuments()).toBe(0);
  });

  it('an expired code is rejected', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'io@example.com');
    await env.db.models.AuthChallenge.updateOne({}, { $set: { otpExpiresAt: new Date(Date.now() - 1000) } });
    const res = await verify(app, { email: 'io@example.com', otp: mail.otp('io@example.com'), pendingToken });
    expect(res.body.error.code).toBe('OTP_INVALID');
    expect(await env.db.models.User.countDocuments()).toBe(0);
  });

  it('a code works once', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'ja@example.com');
    const body = { email: 'ja@example.com', otp: mail.otp('ja@example.com'), pendingToken };
    expect((await verify(app, body)).status).toBe(200);
    const reused = await verify(app, body);
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe('OTP_INVALID');
    expect(await env.db.models.User.countDocuments()).toBe(1);
  });

  it('concurrent verifications with the right code create exactly one account and one session', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'ka@example.com');
    const body = { email: 'ka@example.com', otp: mail.otp('ka@example.com'), pendingToken };
    const results = await Promise.all(Array.from({ length: 5 }, () => verify(app, body)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await env.db.models.User.countDocuments({ email: 'ka@example.com' })).toBe(1);
    expect(await env.db.models.Session.countDocuments()).toBe(1);
  });

  it('the verification page can read the pending email, code expiry and resend wait', async () => {
    const { app } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'oa@example.com');
    const info = await request(app).post('/v1/auth/email-verification/pending').send({ pendingToken });
    expect(info.body.data.email).toBe('oa@example.com');
    expect(info.body.data.codeExpiresInSeconds).toBeGreaterThan(290);
    expect(info.body.data.codeExpiresInSeconds).toBeLessThanOrEqual(300);
    expect(info.body.data.resendAvailableInSeconds).toBeGreaterThan(0);
    const forged = await request(app)
      .put('/v1/auth/email-verification/email')
      .send({ pendingToken: 'y'.repeat(43), newEmail: 'attacker@example.com' });
    expect(forged.status).toBe(404);
  });
});

describe('resending and correcting the email', () => {
  it('30-second cooldown, at most 6 sends per hour, and each new code invalidates the previous one', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'la@example.com');
    const firstOtp = mail.otp('la@example.com');
    const resend = () =>
      request(app).post('/v1/auth/email-verification/resend').send({ email: 'la@example.com', pendingToken });

    const tooSoon = await resend();
    expect(tooSoon.status).toBe(429);
    expect(tooSoon.body.error.code).toBe('RESEND_COOLDOWN');

    for (let i = 0; i < 5; i += 1) {
      await ageSends();
      expect((await resend()).status).toBe(202);
    }
    expect(mail.count('la@example.com')).toBe(6);
    await ageSends();
    expect((await resend()).body.error.code).toBe('RESEND_LIMIT');

    const latest = mail.otp('la@example.com');
    if (firstOtp !== latest) {
      const old = await verify(app, { email: 'la@example.com', otp: firstOtp, pendingToken });
      expect(old.body.error.code).toBe('OTP_INVALID');
    }
    expect((await verify(app, { email: 'la@example.com', otp: latest, pendingToken })).status).toBe(200);
  });

  it('a resend that the provider fails to deliver is reported as an error', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'lb@example.com');
    await ageSends();
    mail.failNext = true;
    const res = await request(app)
      .post('/v1/auth/email-verification/resend')
      .send({ email: 'lb@example.com', pendingToken });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('recovery by email alone gets the same generic response and sends nothing for a pending sign-up', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await registerPending(app, env, 'ma@example.com');
    await ageSends();
    const responses = await Promise.all(
      ['ma@example.com', 'nobody@example.com'].map((email) =>
        request(app).post('/v1/auth/email-verification/resend').send({ email }),
      ),
    );
    for (const res of responses) {
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ success: true, data: { accepted: true } });
    }
    expect(mail.count('ma@example.com')).toBe(1);
  });

  it('changing the email invalidates the old code, sends a new one and creates the account on the new email', async () => {
    const { app, mail } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    const { pendingToken } = await registerPending(app, env, 'na@example.com');
    const oldOtp = mail.otp('na@example.com');
    await ageSends();
    const changed = await request(app)
      .put('/v1/auth/email-verification/email')
      .send({ pendingToken, newEmail: 'na.new@example.com' });
    expect(changed.status).toBe(200);
    expect(changed.body.data).toMatchObject({ email: 'na.new@example.com', verificationEmailSent: true });
    const newOtp = mail.otp('na.new@example.com');
    if (oldOtp !== newOtp) {
      const old = await verify(app, { email: 'na.new@example.com', otp: oldOtp, pendingToken });
      expect(old.body.error.code).toBe('OTP_INVALID');
    }
    expect((await verify(app, { email: 'na.new@example.com', otp: newOtp, pendingToken })).status).toBe(200);
    expect(await env.db.models.User.exists({ email: 'na.new@example.com' })).not.toBeNull();
    expect(await env.db.models.User.exists({ email: 'na@example.com' })).toBeNull();
  });

  it('Google sign-up for the same email ends the pending sign-up', async () => {
    const { app } = env.makeApp({ PUBLIC_SIGNUP_ENABLED: true });
    await registerPending(app, env, 'pg@gmail.com');
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-p', email: 'pg@gmail.com' }), intent: 'signup', acceptTerms: true });
    expect(res.body.data).toMatchObject({ created: true });
    expect(await env.db.models.PendingRegistration.countDocuments()).toBe(0);
    expect(await env.db.models.AuthChallenge.countDocuments()).toBe(0);
  });
});

describe('unverified accounts created before this change (legacy)', () => {
  async function legacyUser(email: string) {
    await env.db.models.User.create({
      email,
      name: 'Legacy User',
      role: 'user',
      passwordHash: await hashPassword(PASSWORD),
      emailVerifiedAt: null,
    });
  }

  it('login is blocked with EMAIL_NOT_VERIFIED; a code from recovery verifies the account', async () => {
    const { app, mail } = env.makeApp();
    await legacyUser('pa@example.com');
    const login = await request(app).post('/v1/auth/login').send({ email: 'pa@example.com', password: PASSWORD });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    expect(
      (await request(app).post('/v1/auth/email-verification/resend').send({ email: 'pa@example.com' })).status,
    ).toBe(202);
    const res = await verify(app, { email: 'pa@example.com', otp: mail.otp('pa@example.com') });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ verified: true, email: 'pa@example.com' });
    expect(
      (await request(app).post('/v1/auth/login').send({ email: 'pa@example.com', password: PASSWORD })).status,
    ).toBe(200);
  });

  it('a verification link verifies once; reused and unknown links are rejected', async () => {
    const { app, mail } = env.makeApp();
    await legacyUser('jo@example.com');
    await request(app).post('/v1/auth/email-verification/resend').send({ email: 'jo@example.com' });
    const token = mail.linkToken('jo@example.com');
    expect((await request(app).post('/v1/auth/email-verification/link').send({ token })).status).toBe(200);
    const reused = await request(app).post('/v1/auth/email-verification/link').send({ token });
    expect(reused.body.error.code).toBe('LINK_INVALID');
  });
});
