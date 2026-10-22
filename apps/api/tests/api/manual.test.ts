import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env?.stop();
});
beforeEach(async () => {
  await env.reset();
});

async function signedIn(email: string) {
  const { app, mail } = env.makeApp({});
  await registerUser(app, env, mail, email);
  return { app, token: await login(app, email) };
}

describe('GET /v1/manual (Website manual workflow steps table)', () => {
  it('requires authentication', async () => {
    const { app } = env.makeApp({});
    const res = await request(app).get('/v1/manual');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns all 8 workflow steps from the database table in order', async () => {
    const { app, token } = await signedIn('user@example.com');
    const res = await request(app).get('/v1/manual').set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.steps)).toBe(true);
    expect(res.body.data.steps).toHaveLength(8);

    const steps = res.body.data.steps;
    // Step 1: Color palette
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].slug).toBe('color-palette');
    expect(steps[0].title).toContain('Colour Palette');
    expect(steps[0].imageUrl).toBe('/images/manual/step-1-palette.jpg');

    // Step 2: Outfit category
    expect(steps[1].stepNumber).toBe(2);
    expect(steps[1].slug).toBe('outfit-category');
    expect(steps[1].imageUrl).toBe('/images/manual/step-2-categories.jpg');

    // Step 3: Discover look
    expect(steps[2].stepNumber).toBe(3);
    expect(steps[2].slug).toBe('discover-look');
    expect(steps[2].imageUrl).toBe('/images/manual/step-3-discover.jpg');

    // Step 4: Shop look
    expect(steps[3].stepNumber).toBe(4);
    expect(steps[3].slug).toBe('shop-look');
    expect(steps[3].imageUrl).toBe('/images/manual/step-4-shop-look.jpg');

    // Step 5: Virtual try on
    expect(steps[4].stepNumber).toBe(5);
    expect(steps[4].slug).toBe('virtual-try-on');
    expect(steps[4].imageUrl).toBe('/images/manual/step-5-virtual-try-on.jpg');

    // Step 6: Design studio
    expect(steps[5].stepNumber).toBe(6);
    expect(steps[5].slug).toBe('design-studio');
    expect(steps[5].imageUrl).toBe('/images/manual/step-6-design-studio.jpg');

    // Step 7: Style assistant
    expect(steps[6].stepNumber).toBe(7);
    expect(steps[6].slug).toBe('style-assistant');
    expect(steps[6].imageUrl).toBe('/images/manual/step-7-style-assistant.jpg');

    // Step 8: Saved outfits
    expect(steps[7].stepNumber).toBe(8);
    expect(steps[7].slug).toBe('saved-outfits');
    expect(steps[7].imageUrl).toBe('/images/manual/step-8-saved-outfits.jpg');

    // All steps have required fields
    for (const step of steps) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.actionLabel).toBeTruthy();
      expect(step.actionHref).toBeTruthy();
      expect(step.highlights.length).toBeGreaterThan(0);
    }
  });
});
