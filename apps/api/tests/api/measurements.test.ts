import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Body measurements and the body type identified from them (D-129).

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

async function signedIn(email: string, department?: 'women' | 'men') {
  const { app, mail } = env.makeApp();
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  if (department) await request(app).put('/v1/profile').set(bearer(token)).send({ department });
  return { app, token };
}

const cm = (inches: number) => Math.round(inches * 2.54 * 10) / 10;
const WOMEN_PEAR = { shoulder: cm(37), bust: cm(34), waist: cm(31), hip: cm(39), highHip: cm(35) };

describe('body measurements (D-129)', () => {
  it('starts empty, in inches', async () => {
    const { app, token } = await signedIn('ana@example.com', 'women');
    const res = await request(app).get('/v1/measurements').set(bearer(token));
    expect(res.body.data).toEqual({ displayUnit: 'in', valuesCm: {}, updatedAt: null, bodyTypeFromMeasurements: null });
  });

  it('needs a Clothing Preference first', async () => {
    const { app, token } = await signedIn('bo@example.com');
    const res = await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'cm', valuesCm: { waist: 70 } });
    expect(res.status).toBe(409);
  });

  it('saving the body-type measurements identifies the body type at once, for review', async () => {
    const { app, token } = await signedIn('cy@example.com', 'women');
    const res = await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'in', valuesCm: WOMEN_PEAR });
    expect(res.status).toBe(200);
    expect(res.body.data.bodyTypeFromMeasurements).toBe('pear');
    const appearance = (await request(app).get('/v1/appearance').set(bearer(token))).body.data;
    expect(appearance.bodyType).toMatchObject({
      value: 'pear',
      source: 'measurements',
      userConfirmed: false,
      estimate: { confidence: null },
    });
    expect(appearance.bodyProportions.value).toBe('hips_wider_than_shoulders');
    expect(await env.db.models.AppearanceAnalysis.countDocuments({ source: 'measurements' })).toBe(1);
  });

  it('fit measurements merge in and do not change a body type the user chose', async () => {
    const { app, token } = await signedIn('di@example.com', 'women');
    await request(app).put('/v1/measurements').set(bearer(token)).send({ displayUnit: 'in', valuesCm: WOMEN_PEAR });
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ bodyType: { value: 'spoon' } });
    const res = await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'cm', valuesCm: { underbust: 72, inseam: 76 }, clear: ['highHip'] });
    expect(res.body.data.valuesCm).toMatchObject({ underbust: 72, inseam: 76, waist: WOMEN_PEAR.waist });
    expect(res.body.data.valuesCm).not.toHaveProperty('highHip');
    expect(res.body.data.bodyTypeFromMeasurements).toBeNull();
    expect((await request(app).get('/v1/appearance').set(bearer(token))).body.data.bodyType).toMatchObject({
      value: 'spoon',
      source: 'user_corrected',
    });
  });

  it('refuses measurements that are not asked for the Clothing Preference, and implausible values', async () => {
    const { app, token } = await signedIn('ed@example.com', 'men');
    for (const valuesCm of [{ bust: 90 }, { underbust: 70 }, { dressLength: 100 }, { waist: 5 }, { height: 170 }]) {
      const res = await request(app).put('/v1/measurements').set(bearer(token)).send({ displayUnit: 'cm', valuesCm });
      expect(res.status, JSON.stringify(valuesCm)).toBe(400);
    }
    const ok = await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'cm', valuesCm: { shoulder: 117, chest: 102, waist: 86, hip: 97, jacketLength: 76 } });
    expect(ok.body.data.bodyTypeFromMeasurements).toBe('trapezoid');
  });

  it('never logs measurement values', async () => {
    const { app, token } = await signedIn('fe@example.com', 'women');
    await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'cm', valuesCm: { ...WOMEN_PEAR, wrist: 15.3 } });
    expect(logTextForPrivacyChecks(env.logLines)).not.toMatch(/15\.3|pear/);
  });

  it('account deletion removes measurements with the profile', async () => {
    const { app, token } = await signedIn('gi@example.com', 'women');
    await request(app).put('/v1/measurements').set(bearer(token)).send({ displayUnit: 'in', valuesCm: WOMEN_PEAR });
    expect(await env.db.models.Profile.countDocuments({ measurements: { $exists: true } })).toBe(1);
  });
});
