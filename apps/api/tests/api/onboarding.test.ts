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
