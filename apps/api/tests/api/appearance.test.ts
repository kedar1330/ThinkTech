import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PASSWORD, bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

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
  const { app } = env.makeApp();
  await registerUser(app, env, email);
  return { app, token: await login(app, email) };
}

const FULL = {
  skinTone: { value: { monkRange: '4-5' } },
  undertone: { value: 'warm' },
  bodyProportions: { value: 'balanced_defined_waist' },
};

describe('self-reported appearance signals (FR-SIG, AC-04)', () => {
  it('starts empty with the toggle on', async () => {
    const { app, token } = await signedIn('ana@example.com');
    const res = await request(app).get('/v1/appearance').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      skinTone: null,
      undertone: null,
      bodyProportions: null,
      useInRecommendations: true,
    });
  });

  it('T-09: stores values as self_reported, userConfirmed: true, with no confidence', async () => {
    const { app, token } = await signedIn('bo@example.com');
    const res = await request(app).put('/v1/appearance').set(bearer(token)).send(FULL);
    expect(res.status).toBe(200);
    for (const name of ['skinTone', 'undertone', 'bodyProportions'] as const) {
      const attr = res.body.data[name];
      expect(attr).toMatchObject({ source: 'self_reported', userConfirmed: true, estimate: null });
      expect(attr.confirmedAt).toEqual(expect.any(String));
      expect(attr).not.toHaveProperty('confidence');
    }
    expect(res.body.data.skinTone.value).toEqual({ monkRange: '4-5' });
    expect(res.body.data.undertone.value).toBe('warm');

    // Stored the same way, with no confidence anywhere.
    const stored = await env.db.models.AppearanceProfile.findOne().lean();
    expect(stored?.undertone).toMatchObject({
      value: 'warm',
      source: 'self_reported',
      userConfirmed: true,
      estimate: null,
    });
    expect(JSON.stringify(stored)).not.toMatch(/confidence/i);

    // GET returns what was saved.
    const get = await request(app).get('/v1/appearance').set(bearer(token));
    expect(get.body.data).toEqual(res.body.data);
  });

  it('changes one field without touching the others, and clears a field with null', async () => {
    const { app, token } = await signedIn('cy@example.com');
    await request(app).put('/v1/appearance').set(bearer(token)).send(FULL);

    const changed = await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ undertone: { value: 'cool' } });
    expect(changed.body.data.undertone.value).toBe('cool');
    expect(changed.body.data.skinTone.value).toEqual({ monkRange: '4-5' });

    const cleared = await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ skinTone: { value: null } });
    expect(cleared.body.data.skinTone).toBeNull();
    expect(cleared.body.data.undertone.value).toBe('cool');
  });

  it('T-10 (storage part): signals can be turned off and back on without losing them', async () => {
    const { app, token } = await signedIn('di@example.com');
    await request(app).put('/v1/appearance').set(bearer(token)).send(FULL);
    const off = await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: false });
    expect(off.body.data.useInRecommendations).toBe(false);
    expect(off.body.data.undertone.value).toBe('warm');
    const on = await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: true });
    expect(on.body.data.useInRecommendations).toBe(true);
  });

  it('rejects invalid values, unknown fields and empty updates', async () => {
    const { app, token } = await signedIn('ed@example.com');
    const bad = [
      { skinTone: { value: { monkRange: '3-9' } } }, // span wider than 2 tones
      { skinTone: { value: { monkRange: '6-4' } } }, // reversed
      { skinTone: { value: '4-5' } }, // must be { monkRange }
      { undertone: { value: 'golden' } },
      { bodyProportions: { value: 'pear' } },
      { undertone: { value: 'warm', confidence: 0.9 } }, // no confidence for self-reported values
      { undertone: 'warm' },
      { useInRecommendations: 'yes' },
      { photo: 'data:image/png;base64,AAAA' },
      {},
    ];
    for (const body of bad) {
      const res = await request(app).put('/v1/appearance').set(bearer(token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect(await env.db.models.AppearanceProfile.countDocuments()).toBe(0);
  });

  it('requires authentication', async () => {
    const { app } = env.makeApp();
    expect((await request(app).get('/v1/appearance')).status).toBe(401);
    expect((await request(app).put('/v1/appearance').send(FULL)).status).toBe(401);
  });

  it('isolates users: each user reads and changes only their own signals', async () => {
    const { app } = env.makeApp();
    await registerUser(app, env, 'fi@example.com');
    await registerUser(app, env, 'gu@example.com');
    const a = await login(app, 'fi@example.com');
    const b = await login(app, 'gu@example.com');
    await request(app).put('/v1/appearance').set(bearer(a)).send(FULL);

    const bView = await request(app).get('/v1/appearance').set(bearer(b));
    expect(bView.body.data.undertone).toBeNull();
    await request(app)
      .put('/v1/appearance')
      .set(bearer(b))
      .send({ undertone: { value: 'olive' } });
    const aView = await request(app).get('/v1/appearance').set(bearer(a));
    expect(aView.body.data.undertone.value).toBe('warm');
    expect(await env.db.models.AppearanceProfile.countDocuments()).toBe(2);
  });

  it('T-11: signal values never appear in logs', async () => {
    const { app, token } = await signedIn('ha@example.com');
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ ...FULL, undertone: { value: 'olive' } });
    await request(app).get('/v1/appearance').set(bearer(token));
    const logs = env.logLines.join('\n');
    expect(logs).toContain('/v1/appearance');
    for (const value of ['4-5', 'olive', 'balanced_defined_waist', 'monkRange']) expect(logs).not.toContain(value);
  });

  it('account deletion removes the signals (FR-AUTH-09)', async () => {
    const { app, token } = await signedIn('io@example.com');
    await request(app).put('/v1/appearance').set(bearer(token)).send(FULL);
    expect(await env.db.models.AppearanceProfile.countDocuments()).toBe(1);
    const res = await request(app).delete('/v1/account').set(bearer(token)).send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await env.db.models.AppearanceProfile.countDocuments()).toBe(0);
  });
});
