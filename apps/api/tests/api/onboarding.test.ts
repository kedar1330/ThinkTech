import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, bearer, googleToken, invite, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

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

describe('onboarding progress (FR-ONB)', () => {
  it('email path: style profile → appearance → complete; login resumes at the next incomplete step', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ana@example.com');
    let token = await login(app, 'ana@example.com');
    expect((await request(app).get('/v1/onboarding').set(bearer(token))).body.data).toEqual({ step: 'style_profile' });

    // The step can't be completed before the profile is saved.
    const early = await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token));
    expect(early.status).toBe(400);
    expect((await request(app).post('/v1/onboarding/appearance/complete').set(bearer(token))).status).toBe(400);

    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    expect((await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token))).body.data).toEqual({
      step: 'appearance',
    });

    // Leave and come back: login says where to resume.
    const relogin = await request(app).post('/v1/auth/login').send({ email: 'ana@example.com', password: PASSWORD });
    expect(relogin.body.data.onboardingStep).toBe('appearance');
    token = relogin.body.data.accessToken;

    // Appearance signals are optional: completing without saving any is allowed (skip).
    expect((await request(app).post('/v1/onboarding/appearance/complete').set(bearer(token))).body.data).toEqual({
      step: 'complete',
    });
    const after = await request(app).post('/v1/auth/login').send({ email: 'ana@example.com', password: PASSWORD });
    expect(after.body.data.onboardingStep).toBe('complete');
    // Completing again doesn't repeat or move backwards.
    expect((await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token))).body.data.step).toBe(
      'complete',
    );
  });

  it('Google path: set password first, then city on the style profile step', async () => {
    const { app } = env.makeApp();
    await invite(env, 'bo@gmail.com');
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-1', email: 'bo@gmail.com' }), intent: 'signup', acceptTerms: true });
    const token = res.body.data.accessToken as string;
    expect((await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token))).body.error.code).toBe(
      'PASSWORD_SETUP_REQUIRED',
    );
    await request(app)
      .post('/v1/auth/password/setup')
      .set(bearer(token))
      .send({ password: PASSWORD, confirmPassword: PASSWORD });
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'men' });
    const noCity = await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token));
    expect(noCity.status).toBe(400);
    expect(noCity.body.error.message).toMatch(/city/i);
    await request(app).put('/v1/account/details').set(bearer(token)).send({ city: 'bengaluru' });
    expect((await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token))).body.data.step).toBe(
      'appearance',
    );
  });

  it('each user sees only their own onboarding state', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'cy@example.com');
    await registerUser(app, env, mail, 'di@example.com');
    const a = await login(app, 'cy@example.com');
    const b = await login(app, 'di@example.com');
    await request(app).put('/v1/profile').set(bearer(a)).send({ department: 'women' });
    await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(a));
    expect((await request(app).get('/v1/onboarding').set(bearer(a))).body.data.step).toBe('appearance');
    expect((await request(app).get('/v1/onboarding').set(bearer(b))).body.data.step).toBe('style_profile');
  });
});

describe('Skip for now (FR-ONB-05)', () => {
  const skip = (app: Parameters<typeof request>[0], token: string) =>
    request(app).post('/v1/onboarding/skip').set(bearer(token));

  it('finishes onboarding without a style profile; persisted, so login goes straight to Home', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'sk@example.com');
    const token = await login(app, 'sk@example.com');
    const res = await skip(app, token);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ step: 'complete' });

    const user = await env.db.models.User.findOne({ email: 'sk@example.com' }).lean();
    expect(user?.onboarding?.skippedAt).toBeInstanceOf(Date);
    expect(user?.onboarding?.styleProfileCompletedAt).toBeInstanceOf(Date);
    expect(user?.onboarding?.appearanceCompletedAt).toBeInstanceOf(Date);
    // Nothing was saved for the user: no profile, no department.
    expect(await env.db.models.Profile.countDocuments()).toBe(0);
    expect((await request(app).get('/v1/profile').set(bearer(token))).body.data.department).toBeNull();

    expect((await request(app).get('/v1/onboarding').set(bearer(token))).body.data).toEqual({ step: 'complete' });
    const relogin = await request(app).post('/v1/auth/login').send({ email: 'sk@example.com', password: PASSWORD });
    expect(relogin.body.data.onboardingStep).toBe('complete');
  });

  it('is idempotent: skipping again changes nothing', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'id@example.com');
    const token = await login(app, 'id@example.com');
    await skip(app, token);
    const first = (await env.db.models.User.findOne({ email: 'id@example.com' }).lean())!.onboarding!;
    const again = await skip(app, token);
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual({ step: 'complete' });
    const second = (await env.db.models.User.findOne({ email: 'id@example.com' }).lean())!.onboarding!;
    expect(second.skippedAt?.getTime()).toBe(first.skippedAt?.getTime());
    expect(second.styleProfileCompletedAt?.getTime()).toBe(first.styleProfileCompletedAt?.getTime());
    expect(second.appearanceCompletedAt?.getTime()).toBe(first.appearanceCompletedAt?.getTime());
  });

  it('Google sign-ups must create a password first; then they can skip without a city', async () => {
    const { app } = env.makeApp();
    await invite(env, 'gs@gmail.com');
    const res = await request(app)
      .post('/v1/auth/google')
      .send({ ...googleToken({ sub: 'g-skip', email: 'gs@gmail.com' }), intent: 'signup', acceptTerms: true });
    const token = res.body.data.accessToken as string;
    const early = await skip(app, token);
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('PASSWORD_SETUP_REQUIRED');
    expect((await request(app).get('/v1/onboarding').set(bearer(token))).body.data.step).toBe('set_password');

    await request(app)
      .post('/v1/auth/password/setup')
      .set(bearer(token))
      .send({ password: PASSWORD, confirmPassword: PASSWORD });
    expect((await skip(app, token)).body.data).toEqual({ step: 'complete' });
    const me = await request(app).get('/v1/auth/me').set(bearer(token));
    expect(me.body.data).toMatchObject({ city: null, onboardingStep: 'complete' });
  });

  it('from the appearance step it just finishes; the style profile is not marked as skipped', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ap@example.com');
    const token = await login(app, 'ap@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    await request(app).post('/v1/onboarding/style-profile/complete').set(bearer(token));
    expect((await skip(app, token)).body.data).toEqual({ step: 'complete' });
    const user = await env.db.models.User.findOne({ email: 'ap@example.com' }).lean();
    expect(user?.onboarding?.skippedAt).toBeNull();
    expect(user?.onboarding?.appearanceCompletedAt).toBeInstanceOf(Date);
  });

  it('a skipped user can complete the profile later without being sent back to onboarding', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'la@example.com');
    const token = await login(app, 'la@example.com');
    await skip(app, token);
    // Completing the profile later still needs a department (it is optional only while skipped).
    const noDept = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ likedColors: ['navy'] });
    expect(noDept.status).toBe(400);
    const saved = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'men', likedColors: ['navy'] });
    expect(saved.status).toBe(200);
    expect(saved.body.data).toMatchObject({ department: 'men', likedColors: ['navy'] });
    expect((await request(app).get('/v1/onboarding').set(bearer(token))).body.data.step).toBe('complete');
  });

  it('requires a signed-in user, and only affects that user', async () => {
    const { app, mail } = env.makeApp();
    expect((await request(app).post('/v1/onboarding/skip')).status).toBe(401);
    await registerUser(app, env, mail, 'aa@example.com');
    await registerUser(app, env, mail, 'bb@example.com');
    await skip(app, await login(app, 'aa@example.com'));
    const b = await login(app, 'bb@example.com');
    expect((await request(app).get('/v1/onboarding').set(bearer(b))).body.data.step).toBe('style_profile');
  });
});
