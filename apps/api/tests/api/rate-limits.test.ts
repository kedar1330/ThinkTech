import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { byIp, byUser, createRateLimits, limiter, MINUTE } from '../../src/middleware/rate-limit';
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

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

describe('T-36: Rate limits (D-38, SECURITY.md §5, §11)', () => {
  it('enforces IP rate limits on auth and returns standard 429 envelope', async () => {
    // Test with low limit to verify behavior quickly
    const customLimits = {
      login: [limiter(MINUTE, 2, byIp)],
      register: [limiter(MINUTE, 2, byIp)],
      google: [limiter(MINUTE, 2, byIp)],
      logout: [limiter(MINUTE, 2, byUser)],
      codeCheck: [limiter(MINUTE, 2, byIp)],
      codeSend: [limiter(MINUTE, 2, byIp)],
      resetConfirm: [limiter(MINUTE, 2, byIp)],
      accountSecurity: [limiter(MINUTE, 2, byUser)],
      deleteAccount: [limiter(MINUTE, 2, byUser)],
      recommendations: [limiter(MINUTE, 2, byUser)],
      feedback: [limiter(MINUTE, 2, byUser)],
      shortlistWrite: [limiter(MINUTE, 2, byUser)],
    };

    const { app, mail } = env.makeApp({}, { rateLimits: customLimits });
    await registerUser(app, env, mail, 'user1@example.com');

    // 2 logins allowed
    const res1 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'user1@example.com', password: 'WrongPassword1!' });
    expect(res1.status).toBe(401);
    const res2 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'user1@example.com', password: 'WrongPassword1!' });
    expect(res2.status).toBe(401);

    // 3rd login hits rate limit
    const res3 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'user1@example.com', password: 'WrongPassword1!' });
    expect(res3.status).toBe(429);
    expect(res3.body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests — please try again later',
        retryAfterSeconds: 60,
      },
    });
    expect(res3.headers['retry-after']).toBe('60');
  });

  it('enforces per-user rate limit on recommendations and shortlist writes', async () => {
    const customLimits = {
      login: [limiter(MINUTE, 10, byIp)],
      register: [limiter(MINUTE, 10, byIp)],
      google: [limiter(MINUTE, 10, byIp)],
      logout: [limiter(MINUTE, 10, byUser)],
      codeCheck: [limiter(MINUTE, 10, byIp)],
      codeSend: [limiter(MINUTE, 10, byIp)],
      resetConfirm: [limiter(MINUTE, 10, byIp)],
      accountSecurity: [limiter(MINUTE, 10, byUser)],
      deleteAccount: [limiter(MINUTE, 10, byUser)],
      recommendations: [limiter(MINUTE, 2, byUser)],
      feedback: [limiter(MINUTE, 2, byUser)],
      shortlistWrite: [limiter(MINUTE, 2, byUser)],
    };

    const { app, mail } = env.makeApp({}, { rateLimits: customLimits });
    await registerUser(app, env, mail, 'rec@example.com');
    await registerUser(app, env, mail, 'other@example.com');
    const token = await login(app, 'rec@example.com');
    const otherToken = await login(app, 'other@example.com');

    // Recommendations rate limiting (limit: 2)
    const rec1 = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(rec1.status).toBe(200);
    const rec2 = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(rec2.status).toBe(200);

    const rec3 = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(rec3.status).toBe(429);
    expect(rec3.body.error.code).toBe('RATE_LIMITED');

    // Other user is NOT rate-limited (isolation)
    const otherRec = await request(app)
      .post('/v1/recommendations')
      .set(bearer(otherToken))
      .send({ occasion: 'everyday' });
    expect(otherRec.status).toBe(200);

    // Shortlist write rate limiting (limit: 2)
    const short1 = await request(app)
      .post('/v1/shortlist')
      .set(bearer(token))
      .send({ name: 'Item 1', priceEntered: 500 });
    expect(short1.status).toBe(201);

    const short2 = await request(app)
      .post('/v1/shortlist')
      .set(bearer(token))
      .send({ name: 'Item 2', priceEntered: 600 });
    expect(short2.status).toBe(201);

    const short3 = await request(app)
      .post('/v1/shortlist')
      .set(bearer(token))
      .send({ name: 'Item 3', priceEntered: 700 });
    expect(short3.status).toBe(429);
    expect(short3.body.error.code).toBe('RATE_LIMITED');
  });

  it('default createRateLimits provides all required limits per D-38', () => {
    const limits = createRateLimits();
    expect(limits.login).toHaveLength(2); // minute and hour
    expect(limits.register).toHaveLength(2);
    expect(limits.google).toHaveLength(1);
    expect(limits.logout).toHaveLength(1);
    expect(limits.codeCheck).toHaveLength(2);
    expect(limits.codeSend).toHaveLength(2);
    expect(limits.resetConfirm).toHaveLength(1);
    expect(limits.accountSecurity).toHaveLength(1);
    expect(limits.deleteAccount).toHaveLength(1);
    expect(limits.recommendations).toHaveLength(1);
    expect(limits.feedback).toHaveLength(1);
    expect(limits.shortlistWrite).toHaveLength(1);
  });
});
