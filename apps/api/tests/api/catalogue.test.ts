import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

async function signedIn(email: string) {
  const { app, mail } = env.makeApp({});
  await registerUser(app, env, mail, email);
  return { app, token: await login(app, email) };
}

describe('/v1/catalogue (Outfit Categories backend)', () => {
  it('every endpoint requires authentication', async () => {
    const { app } = env.makeApp({});
    for (const call of [
      request(app).get('/v1/catalogue/categories'),
      request(app).get('/v1/catalogue/styles'),
      request(app).get('/v1/catalogue/styles/CST-101'),
      request(app).get('/v1/catalogue/styles/compare?ids=CST-101,CST-102'),
    ]) {
      const res = await call;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('GET /v1/catalogue/categories lists starter published categories and supports department filtering', async () => {
    const { app, token } = await signedIn('cat@example.com');

    // All categories
    const resAll = await request(app)
      .get('/v1/catalogue/categories')
      .set(bearer(token));
    expect(resAll.status).toBe(200);
    expect(resAll.body.success).toBe(true);
    expect(Array.isArray(resAll.body.data)).toBe(true);
    expect(resAll.body.data.length).toBeGreaterThanOrEqual(10);

    // Women department only
    const resWomen = await request(app)
      .get('/v1/catalogue/categories?department=women')
      .set(bearer(token));
    expect(resWomen.status).toBe(200);
    expect(resWomen.body.data.every((c: { department: string }) => c.department === 'women')).toBe(true);

    // Men department only
    const resMen = await request(app)
      .get('/v1/catalogue/categories?department=men')
      .set(bearer(token));
    expect(resMen.status).toBe(200);
    expect(resMen.body.data.every((c: { department: string }) => c.department === 'men')).toBe(true);
  });

  it('GET /v1/catalogue/styles lists styles and supports pagination', async () => {
    const { app, token } = await signedIn('styles@example.com');

    const res = await request(app)
      .get('/v1/catalogue/styles?page=1&limit=5')
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(5);
    expect(res.body.data.items.length).toBeLessThanOrEqual(5);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  it('GET /v1/catalogue/styles filters by body shape and styling goal', async () => {
    const { app, token } = await signedIn('filter@example.com');

    // Filter by bodyShape
    const resPear = await request(app)
      .get('/v1/catalogue/styles?bodyShape=pear')
      .set(bearer(token));

    expect(resPear.status).toBe(200);
    expect(resPear.body.data.items.length).toBeGreaterThan(0);
    for (const style of resPear.body.data.items) {
      expect(style.bodyShapes).toContain('pear');
    }

    // Filter by stylingGoal
    const resGoal = await request(app)
      .get('/v1/catalogue/styles?goal=define_waist')
      .set(bearer(token));

    expect(resGoal.status).toBe(200);
    expect(resGoal.body.data.items.length).toBeGreaterThan(0);
    for (const style of resGoal.body.data.items) {
      expect(style.stylingGoals).toContain('define_waist');
    }
  });

  it('GET /v1/catalogue/styles filters by search query q', async () => {
    const { app, token } = await signedIn('search@example.com');

    const res = await request(app)
      .get('/v1/catalogue/styles?q=Kurti')
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const style of res.body.data.items) {
      const match =
        style.name.toLowerCase().includes('kurti') ||
        style.description.toLowerCase().includes('kurti');
      expect(match).toBe(true);
    }
  });

  it('GET /v1/catalogue/styles/:styleId returns full detail or 404', async () => {
    const { app, token } = await signedIn('detail@example.com');

    // Existing style
    const res = await request(app)
      .get('/v1/catalogue/styles/CST-101')
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.styleId).toBe('CST-101');
    expect(res.body.data.explanation.summary).toBeTruthy();
    expect(res.body.data.explanation.benefits.length).toBeGreaterThan(0);
    expect(res.body.data.explanation.stylingTips.length).toBeGreaterThan(0);

    // Non-existent style
    const resNotFound = await request(app)
      .get('/v1/catalogue/styles/CST-99999')
      .set(bearer(token));

    expect(resNotFound.status).toBe(404);
    expect(resNotFound.body.error.code).toBe('NOT_FOUND');
  });

  it('GET /v1/catalogue/styles/compare returns compared styles side-by-side', async () => {
    const { app, token } = await signedIn('compare@example.com');

    const res = await request(app)
      .get('/v1/catalogue/styles/compare?ids=CST-101,CST-102')
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    const styleIds = res.body.data.map((s: { styleId: string }) => s.styleId);
    expect(styleIds).toContain('CST-101');
    expect(styleIds).toContain('CST-102');
  });
});
