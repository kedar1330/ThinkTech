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
  const { app, mail } = env.makeApp();
  await registerUser(app, env, mail, email);
  return { app, mail, email, token: await login(app, email) };
}

const FULL = {
  department: 'women',
  ageGroup: '25_34',
  heightCm: 163,
  sizes: {
    tops: { letter: 'M', collarIn: 14.5 },
    bottoms: { waistIn: 30, lengthIn: 31 },
    ethnicTops: { letter: 'M' },
    ethnicSets: { waistIn: 30 },
    shoes: { uk: 6 },
  },
  fitPreferences: { tops: 'regular', bottoms: 'relaxed', ethnicTops: 'regular', ethnicSets: 'slim' },
  likedColors: ['navy', 'mustard'],
  dislikedColors: ['fuchsia'],
  contrastPreference: 'medium',
  silhouettePreferences: ['straight', 'a_line'],
  coveragePreferences: { minSleeveLength: 'elbow', minNecklineCoverage: 'moderate', minGarmentLength: 'knee' },
  comfortPreferences: ['breathable', 'flat_footwear'],
  fabricPreferences: { liked: ['cotton', 'linen'], avoided: ['polyester_blend'] },
  preferredStyles: ['classic', 'fusion'],
  preferredOccasions: ['work', 'festive'],
  budgetPreference: 2500,
};

describe('style profile (FR-PROF, FR-SIZE, AC-03)', () => {
  it('starts empty: department null and every list empty', async () => {
    const { app, token } = await signedIn('ana@example.com');
    const res = await request(app).get('/v1/profile').set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      department: null,
      sizes: { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null, shoes: null },
      likedColors: [],
      budgetPreference: null,
      updatedAt: null,
    });
  });

  it('AC-03: a profile can be saved with only department', async () => {
    const { app, token } = await signedIn('bo@example.com');
    const res = await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'men' });
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('men');
    expect(res.body.data.updatedAt).toEqual(expect.any(String));
  });

  it('saves and returns every field', async () => {
    const { app, token } = await signedIn('cy@example.com');
    const res = await request(app).put('/v1/profile').set(bearer(token)).send(FULL);
    expect(res.status).toBe(200);
    const { updatedAt, ...saved } = res.body.data;
    expect(updatedAt).toEqual(expect.any(String));
    expect(saved).toEqual(FULL);
    const get = await request(app).get('/v1/profile').set(bearer(token));
    expect(get.body.data).toEqual(res.body.data);
  });

  it('leaves omitted fields unchanged and clears fields sent as null or empty', async () => {
    const { app, token } = await signedIn('di@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send(FULL);

    const partial = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'men', likedColors: ['teal'] });
    expect(partial.body.data.department).toBe('men');
    expect(partial.body.data.likedColors).toEqual(['teal']);
    expect(partial.body.data.sizes.tops).toEqual({ letter: 'M', collarIn: 14.5 });
    expect(partial.body.data.budgetPreference).toBe(2500);

    const cleared = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({
        department: 'men',
        budgetPreference: null,
        dislikedColors: [],
        sizes: { tops: null, shoes: { uk: 7 } },
        contrastPreference: null,
        fabricPreferences: null,
      });
    expect(cleared.body.data.budgetPreference).toBeNull();
    expect(cleared.body.data.dislikedColors).toEqual([]);
    expect(cleared.body.data.sizes).toEqual({
      tops: null,
      bottoms: null,
      ethnicTops: null,
      ethnicSets: null,
      shoes: { uk: 7 },
    });
    expect(cleared.body.data.contrastPreference).toBeNull();
    expect(cleared.body.data.fabricPreferences).toEqual({ liked: [], avoided: [] });
  });

  it('T-07: missing department, invalid values, and age range or height are rejected', async () => {
    const { app, token } = await signedIn('ed@example.com');
    const bad = [
      {},
      { likedColors: ['navy'] },
      { department: 'kids' },
      { department: 'women', likedColors: ['neon_green'] },
      { department: 'women', preferredOccasions: ['brunch'] },
      { department: 'women', likedColors: ['navy', 'navy'] },
      { department: 'women', sizes: { tops: { letter: 'XXXL' } } },
      { department: 'women', sizes: { bottoms: { waistIn: 80 } } },
      { department: 'women', sizes: { ethnicTops: {} } },
      { department: 'women', sizes: { dresses: { letter: 'M' } } },
      { department: 'women', fitPreferences: { tops: 'skinny' } },
      { department: 'women', coveragePreferences: { minSleeveLength: 'long' } },
      { department: 'women', ageRange: '25-34' },
      { department: 'women', height: 165 },
    ];
    for (const body of bad) {
      const res = await request(app).put('/v1/profile').set(bearer(token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
    expect(await env.db.models.Profile.countDocuments()).toBe(0);
  });

  it('D-131: height is saved in whole centimetres, kept when omitted, cleared with null and range-checked', async () => {
    const { app, token } = await signedIn('ha@example.com');
    const saved = await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', heightCm: 162 });
    expect(saved.status).toBe(200);
    expect(saved.body.data.heightCm).toBe(162);

    const kept = await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    expect(kept.body.data.heightCm).toBe(162);

    for (const heightCm of [119, 231, 162.5, '162']) {
      const res = await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', heightCm });
      expect(res.status, String(heightCm)).toBe(400);
    }

    const cleared = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', heightCm: null });
    expect(cleared.body.data.heightCm).toBeNull();
  });

  it('T-08: measurements and a budget ≤ 0 are rejected; a positive budget is saved', async () => {
    const { app, token } = await signedIn('fi@example.com');
    for (const body of [
      { department: 'women', measurements: { chestCm: 90 } },
      { department: 'women', budgetPreference: 0 },
      { department: 'women', budgetPreference: -100 },
      { department: 'women', budgetPreference: 99.5 },
      { department: 'women', budgetPreference: 2_000_000 },
    ]) {
      const res = await request(app).put('/v1/profile').set(bearer(token)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    const ok = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', budgetPreference: 3000 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.budgetPreference).toBe(3000);
    expect(JSON.stringify(await env.db.models.Profile.findOne().lean())).not.toMatch(/measurement|ageRange|height/);
  });

  it('a colour both liked and disliked is stored as given (the generator applies the restrictive choice)', async () => {
    const { app, token } = await signedIn('gu@example.com');
    const res = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', likedColors: ['navy'], dislikedColors: ['navy'] });
    expect(res.status).toBe(200);
    expect(res.body.data.likedColors).toEqual(['navy']);
    expect(res.body.data.dislikedColors).toEqual(['navy']);
  });

  it('requires authentication', async () => {
    const { app } = env.makeApp();
    expect((await request(app).get('/v1/profile')).status).toBe(401);
    expect((await request(app).put('/v1/profile').send(FULL)).status).toBe(401);
  });

  it('FR-PROF-06: users read and change only their own profile', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'ha@example.com');
    await registerUser(app, env, mail, 'io@example.com');
    const a = await login(app, 'ha@example.com');
    const b = await login(app, 'io@example.com');
    await request(app).put('/v1/profile').set(bearer(a)).send(FULL);

    expect((await request(app).get('/v1/profile').set(bearer(b))).body.data.department).toBeNull();
    await request(app).put('/v1/profile').set(bearer(b)).send({ department: 'men' });
    expect((await request(app).get('/v1/profile').set(bearer(a))).body.data.department).toBe('women');
    expect(await env.db.models.Profile.countDocuments()).toBe(2);
  });

  it('account deletion removes the profile (FR-AUTH-09)', async () => {
    const { app, token, mail, email } = await signedIn('jo@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send(FULL);
    expect(await env.db.models.Profile.countDocuments()).toBe(1);
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    expect(
      (
        await request(app)
          .delete('/v1/account')
          .set(bearer(token))
          .send({ otp: mail.otp(email), confirm: true })
      ).status,
    ).toBe(200);
    expect(await env.db.models.Profile.countDocuments()).toBe(0);
  });

  it('D-129: the Clothing Preference is Women’s Wear or Men’s Wear only; age group is accepted; other My Profile fields are not', async () => {
    const { app, token } = await signedIn('ko@example.com');
    for (const body of [
      { department: 'any' },
      { department: 'women', ageGroup: '17' },
      { department: 'women', categoryBudgets: { tops: 1000 } },
      { department: 'women', customOccasions: ['Sangeet'] },
    ]) {
      expect((await request(app).put('/v1/profile').set(bearer(token)).send(body)).status, JSON.stringify(body)).toBe(
        400,
      );
    }
    const res = await request(app)
      .put('/v1/profile')
      .set(bearer(token))
      .send({ department: 'women', ageGroup: '18_24' });
    expect(res.body.data.ageGroup).toBe('18_24');
    await env.db.models.Profile.updateOne(
      {},
      { measurements: { displayUnit: 'cm', valuesCm: { waist: 78 } }, customOccasions: ['x'] },
    );
    const get = await request(app).get('/v1/profile').set(bearer(token));
    // `updatedAt` is left out: a timestamp such as "…:45.078Z" would match the stored waist value 78.
    const { updatedAt: _updatedAt, ...returned } = get.body.data;
    expect(JSON.stringify(returned)).not.toMatch(/measurements|customOccasions|78/);
  });

  it('D-129: changing the Clothing Preference clears a body type the new list does not offer', async () => {
    const { app, token } = await signedIn('mo@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ bodyType: { value: 'spoon' } });
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women', ageGroup: '25_34' });
    expect((await request(app).get('/v1/appearance').set(bearer(token))).body.data.bodyType.value).toBe('spoon');

    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'men' });
    const after = (await request(app).get('/v1/appearance').set(bearer(token))).body.data;
    expect(after.bodyType).toBeNull();
    expect(after.bodyProportions).toBeNull();

    // A body type both lists offer is kept.
    await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ bodyType: { value: 'rectangle' } });
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    expect((await request(app).get('/v1/appearance').set(bearer(token))).body.data.bodyType.value).toBe('rectangle');
  });

  it('account deletion also removes proposed photo metadata and appearance analyses', async () => {
    const { app, token, mail, email } = await signedIn('lo@example.com');
    const me = await request(app).get('/v1/auth/me').set(bearer(token));
    const userId = me.body.data.id as string;
    const photo = await env.db.models.UserPhoto.create({
      userId,
      kind: 'face',
      data: Buffer.from('synthetic test bytes'),
      contentType: 'image/jpeg',
      bytes: 1000,
      retention: 'keep',
      uploadedAt: new Date(),
    });
    await env.db.models.AppearanceAnalysis.create({
      userId,
      kind: 'skin_tone',
      source: 'photo',
      photoIds: [photo._id],
      result: { monkRange: '5-6' },
      confidence: 'medium',
      analysisVersion: 'test',
    });
    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp(email), confirm: true });
    expect(await env.db.models.UserPhoto.countDocuments()).toBe(0);
    expect(await env.db.models.AppearanceAnalysis.countDocuments()).toBe(0);
  });
});
