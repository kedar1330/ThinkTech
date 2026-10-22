import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PHOTO_NOTICE_VERSION } from '@styleme/contracts';
import { FakeVisionProvider, SYNTHETIC_JPEG, SYNTHETIC_PNG } from '../fixtures/vision';
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Photo upload and Gemini analysis (D-129): face photo → skin tone and undertone, full-body photo → body type.

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

async function signedIn(email: string, vision: FakeVisionProvider | null = new FakeVisionProvider(), overrides = {}) {
  const { app, mail } = env.makeApp(overrides, vision ? { vision } : {});
  await registerUser(app, env, mail, email);
  return { app, vision, token: await login(app, email) };
}

function upload(
  app: Parameters<typeof request>[0],
  token: string,
  kind: string,
  bytes = SYNTHETIC_JPEG,
  type = 'image/jpeg',
) {
  return request(app)
    .post(`/v1/photos?kind=${kind}&notice=${PHOTO_NOTICE_VERSION}`)
    .set(bearer(token))
    .set('content-type', type)
    .send(bytes);
}

describe('face photo analysis (D-129)', () => {
  it('stores the photo, analyses it and returns skin tone and undertone at once, unconfirmed', async () => {
    const { app, token, vision } = await signedIn('ana@example.com');
    const res = await upload(app, token, 'face');
    expect(res.status).toBe(201);
    expect(res.body.data.analysis).toMatchObject({
      kind: 'skin_tone',
      source: 'photo',
      result: { monkTone: 6, undertone: 'warm' },
      confidence: 'high',
      status: 'pending_review',
    });
    expect(res.body.data.appearance.skinTone).toMatchObject({
      value: { monkRange: '6-6' },
      source: 'photo_estimate',
      userConfirmed: false,
      estimate: { confidence: 'high' },
    });
    expect(res.body.data.appearance.undertone.value).toBe('warm');
    expect(res.body.data.photo).toMatchObject({
      kind: 'face',
      angle: null,
      contentType: 'image/jpeg',
      retention: 'keep',
    });
    expect(res.body.data.photo).not.toHaveProperty('data');

    // Only the photo goes to the provider; the user's stored data is readable by every feature.
    expect(vision!.calls).toHaveLength(1);
    expect(Object.keys(vision!.calls[0]!.photo)).toEqual(['bytes', 'contentType']);
    const stored = await env.db.models.UserPhoto.findOne().select('+data').lean();
    expect(Buffer.from((stored!.data as { buffer: Uint8Array }).buffer)).toEqual(SYNTHETIC_JPEG);
    const appearance = await request(app).get('/v1/appearance').set(bearer(token));
    expect(appearance.body.data.skinTone.value).toEqual({ monkRange: '6-6' });
    const profile = await env.db.models.AppearanceProfile.findOne().lean();
    expect(profile?.photoConsent?.face?.noticeVersion).toBe(PHOTO_NOTICE_VERSION);
  });

  it('the user can confirm the result, or correct it (recorded as user_corrected)', async () => {
    const { app, token } = await signedIn('bo@example.com');
    await upload(app, token, 'face');
    const confirmed = await request(app)
      .post('/v1/appearance/confirm')
      .set(bearer(token))
      .send({ attributes: ['skinTone'] });
    expect(confirmed.body.data.skinTone).toMatchObject({ source: 'photo_estimate', userConfirmed: true });
    expect(confirmed.body.data.undertone.userConfirmed).toBe(false);

    const corrected = await request(app)
      .put('/v1/appearance')
      .set(bearer(token))
      .send({ undertone: { value: 'olive' } });
    expect(corrected.body.data.undertone).toMatchObject({
      value: 'olive',
      source: 'user_corrected',
      userConfirmed: true,
    });
    expect(await env.db.models.AppearanceAnalysis.countDocuments({ status: 'corrected' })).toBe(1);
  });

  it('keeps only the newest photo of each kind', async () => {
    const { app, token } = await signedIn('cy@example.com');
    await upload(app, token, 'face');
    await upload(app, token, 'face', SYNTHETIC_PNG, 'image/png');
    const list = await request(app).get('/v1/photos').set(bearer(token));
    expect(list.body.data.analysisAvailable).toBe(true);
    expect(list.body.data.photos).toHaveLength(1);
    expect(list.body.data.photos[0].contentType).toBe('image/png');
    expect(await env.db.models.AppearanceAnalysis.countDocuments({ status: 'superseded' })).toBe(1);
  });

  it('an unusable photo is not stored and the user is told why', async () => {
    const vision = new FakeVisionProvider();
    vision.face = { kind: 'reply', body: { usable: false, qualityIssues: ['too_dark', 'made_up_issue'] } };
    const { app, token } = await signedIn('di@example.com', vision);
    const res = await upload(app, token, 'face');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PHOTO_UNUSABLE');
    expect(res.body.error.message).toMatch(/too dark/);
    expect(await env.db.models.UserPhoto.countDocuments()).toBe(0);
  });

  it('values outside the lists, or a provider failure, give AI_UNAVAILABLE and store nothing', async () => {
    const vision = new FakeVisionProvider();
    vision.face = { kind: 'reply', body: { usable: true, monkTone: 12, undertone: 'golden', confidence: 'high' } };
    const { app, token } = await signedIn('ed@example.com', vision);
    expect((await upload(app, token, 'face')).body.error.code).toBe('AI_UNAVAILABLE');
    vision.face = { kind: 'fail', cause: 'timeout' };
    expect((await upload(app, token, 'face')).body.error.code).toBe('AI_UNAVAILABLE');
    expect(await env.db.models.UserPhoto.countDocuments()).toBe(0);
    expect(await env.db.models.AppearanceProfile.countDocuments({ skinTone: { $ne: null } })).toBe(0);
  });

  it('never logs the photo, the result or the model reply', async () => {
    const vision = new FakeVisionProvider();
    vision.face = { kind: 'reply', body: { usable: true, monkTone: 7, undertone: 'olive', confidence: 'low' } };
    const { app, token } = await signedIn('fe@example.com', vision);
    await upload(app, token, 'face');
    const logs = env.logLines.join('\n');
    expect(logs).not.toMatch(/olive|monkTone|"7-7"|AQEBAQ/);
  });
});

describe('body photo analysis (D-129)', () => {
  it('needs a Clothing Preference, then chooses only from that list', async () => {
    const { app, token, vision } = await signedIn('gi@example.com');
    expect((await upload(app, token, 'body')).body.error.code).toBe('CONFLICT');

    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' });
    const res = await upload(app, token, 'body');
    expect(res.status).toBe(201);
    expect(res.body.data.photo).toMatchObject({ kind: 'body', angle: 'front' });
    expect(res.body.data.appearance.bodyType).toMatchObject({ value: 'pear', source: 'photo_estimate' });
    expect(res.body.data.appearance.bodyProportions.value).toBe('hips_wider_than_shoulders');
    expect(vision!.calls.at(-1)!.department).toBe('women');
    expect(vision!.calls.at(-1)!.heightCm).toBeNull();

    // "Trapezoid" is a men's body type: refused for Women's Wear.
    vision!.body = { kind: 'reply', body: { usable: true, bodyType: 'trapezoid', confidence: 'high' } };
    expect((await upload(app, token, 'body')).body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('D-131: sends the profile height with a body photo only, never with a face photo', async () => {
    const { app, token, vision } = await signedIn('hh@example.com');
    await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'men', heightCm: 178 });
    vision!.body = { kind: 'reply', body: { usable: true, bodyType: 'rectangle', confidence: 'medium' } };

    expect((await upload(app, token, 'body')).status).toBe(201);
    expect((await upload(app, token, 'face')).status).toBe(201);
    const [body, face] = vision!.calls;
    expect(body).toMatchObject({ kind: 'body', department: 'men', heightCm: 178 });
    expect(face).toMatchObject({ kind: 'face', heightCm: null });

    const analysis = await env.db.models.AppearanceAnalysis.findOne({ kind: 'body_shape' }).lean();
    expect(analysis?.analysisVersion).toBe('photo-analysis-v2');
  });
});

describe('photo upload rules (D-129)', () => {
  it('requires the current photo notice, an image type and a matching file signature', async () => {
    const { app, token } = await signedIn('hu@example.com');
    const noNotice = await request(app)
      .post('/v1/photos?kind=face')
      .set(bearer(token))
      .set('content-type', 'image/jpeg')
      .send(SYNTHETIC_JPEG);
    expect(noNotice.status).toBe(400);
    expect((await upload(app, token, 'face', Buffer.from('not an image at all'))).status).toBe(400);
    const json = await request(app)
      .post(`/v1/photos?kind=face&notice=${PHOTO_NOTICE_VERSION}`)
      .set(bearer(token))
      .send({ photo: 'x' });
    expect(json.status).toBe(400);
  });

  it('without a Gemini key the feature reports it is unavailable, and the user can choose manually', async () => {
    const { app, token } = await signedIn('io@example.com', null);
    const res = await upload(app, token, 'face');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
    expect((await request(app).get('/v1/photos').set(bearer(token))).body.data.analysisAvailable).toBe(false);
  });

  it('PHOTO_ANALYSIS_ENABLED=false switches analysis off even with a provider', async () => {
    const { app, token } = await signedIn('ju@example.com', new FakeVisionProvider(), {
      PHOTO_ANALYSIS_ENABLED: false,
    });
    expect((await upload(app, token, 'face')).body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('users list and delete only their own photos', async () => {
    const a = await signedIn('ka@example.com');
    const uploaded = await upload(a.app, a.token, 'face');
    const photoId = uploaded.body.data.photo.id as string;
    const { app, mail } = env.makeApp({}, { vision: new FakeVisionProvider() });
    await registerUser(app, env, mail, 'kb@example.com');
    const b = await login(app, 'kb@example.com');
    expect((await request(app).get('/v1/photos').set(bearer(b))).body.data.photos).toEqual([]);
    expect((await request(app).get(`/v1/photos/${photoId}/image`).set(bearer(b))).status).toBe(404);
    expect((await request(app).delete(`/v1/photos/${photoId}`).set(bearer(b))).status).toBe(404);
    const own = await request(a.app).get(`/v1/photos/${photoId}/image`).set(bearer(a.token));
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/jpeg');
    expect(own.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.compare(own.body as Buffer, SYNTHETIC_JPEG)).toBe(0);
    expect((await request(a.app).delete(`/v1/photos/${photoId}`).set(bearer(a.token))).status).toBe(200);
    expect(await env.db.models.UserPhoto.countDocuments()).toBe(0);
  });
});
