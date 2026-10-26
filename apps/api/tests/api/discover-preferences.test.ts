import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DesignSelectionItem, Look, OutfitDetail } from '@styleme/contracts';
import { loadStyleLibrary } from '../../src/style-rules';
import { buildEngineFixtureLibrary } from '../fixtures/style-library';
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Discover My Style uses what the user chose elsewhere: colours liked or avoided in My Colour Palette (D-133)
// and the designs saved in Outfit Categories (D-132). Synthetic colours and designs only.

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

const styleLibrary = loadStyleLibrary(buildEngineFixtureLibrary(), { allowFixtures: true });

async function signedIn(email: string) {
  const { app, mail } = env.makeApp({}, { styleLibrary });
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  await request(app).put('/v1/profile').set(bearer(token)).send({ department: 'women' }).expect(200);
  const user = await env.db.models.User.findOne({ email }).lean();
  return { app, token, userId: user!._id };
}

const swatch = (colourId: string, name: string, hex: string) => ({
  colourId,
  name,
  hex,
  rgb: [0, 0, 0],
  oklch: { l: 0.5, c: 0.1, h: 0 },
  family: 'blue',
  temperature: 'cool',
  depth: 'deep',
  intensity: 'medium',
  source: 'css',
  isFixture: true,
});

describe('colours from My Colour Palette in Discover My Style', () => {
  it('does not use liked palette colours for Discover My Style suggestions, keeping them decoupled', async () => {
    const { app, token, userId } = await signedIn('palette@example.com');
    const before = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(before.body.data.defaultsApplied).toContain('colors');

    await env.db.models.ColourSwatch.insertMany([
      swatch('CLR-9001', 'Deep navy', '#1E2B45'),
      swatch('CLR-9002', 'Snow', '#FEFEFE'),
    ]);
    await env.db.models.UserColourPreference.create({
      userId,
      colours: [
        { colourId: 'CLR-9001', preference: 'liked', savedAt: new Date() },
        { colourId: 'CLR-9002', preference: 'avoided', savedAt: new Date() },
      ],
    });

    const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(res.status).toBe(200);
    const looks = res.body.data.looks as Look[];
    expect(looks.length).toBeGreaterThan(0);
    expect(looks.flatMap((l) => l.slots.flatMap((s) => s.swatches.map((w) => w.colorId)))).not.toContain('white');

    const detail = (await request(app).get(`/v1/outfits/${looks[0]!.id}`).set(bearer(token))).body.data as OutfitDetail;
    expect(detail.inputsUsed.likedColors).not.toContain('navy');
    expect(detail.inputsUsed.dislikedColors).toContain('white');
  });
});

describe('measurements from My Profile in look generation', () => {
  // Synthetic measurements (cm) with hips clearly wider than the bust.
  const MEASUREMENTS = { shoulder: 98, bust: 86, waist: 70, hip: 104, highHip: 92 };

  async function signalsUsed(app: import('express').Express, token: string) {
    const res = await request(app).post('/v1/recommendations').set(bearer(token)).send({ occasion: 'everyday' });
    expect(res.status).toBe(200);
    const [look] = res.body.data.looks as Look[];
    const detail = (await request(app).get(`/v1/outfits/${look!.id}`).set(bearer(token))).body.data as OutfitDetail;
    return { used: detail.inputsUsed.signalsUsed, defaults: res.body.data.defaultsApplied as string[] };
  }

  it('uses the body type the measurements identify, only while appearance signals are allowed', async () => {
    const { app, token } = await signedIn('measure@example.com');
    expect(await signalsUsed(app, token)).toMatchObject({ used: false });

    await request(app)
      .put('/v1/measurements')
      .set(bearer(token))
      .send({ displayUnit: 'cm', valuesCm: MEASUREMENTS })
      .expect(200);
    const withMeasurements = await signalsUsed(app, token);
    expect(withMeasurements.used).toBe(true);
    expect(withMeasurements.defaults).not.toContain('signals');

    await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: false }).expect(200);
    expect(await signalsUsed(app, token)).toMatchObject({ used: false });
  });
});

describe('saved designs listed for Discover My Style', () => {
  it('names the garment and each chosen feature', async () => {
    const { app, token, userId } = await signedIn('designs@example.com');
    await env.db.models.DesignFeature.create({
      featureId: 'neckline_v_neck',
      slug: 'v_neck',
      name: 'V-neck',
      featureCategory: 'neckline',
      departments: ['women'],
      garmentKinds: ['top'],
      description: 'Synthetic test feature.',
      status: 'published',
    });
    await env.db.models.UserDesignSelection.create({
      userId,
      clothingPreference: 'women',
      outfitCategory: 'indian',
      garmentType: 'kurti',
      selectedFeatures: { neckline: 'neckline_v_neck' },
      savedAt: new Date(),
    });
    const res = await request(app).get('/v1/design/selections').set(bearer(token));
    expect(res.status).toBe(200);
    const [item] = res.body.data as DesignSelectionItem[];
    expect(item).toMatchObject({
      garmentType: 'kurti',
      garmentName: 'Kurti',
      features: [{ category: 'neckline', featureId: 'neckline_v_neck', name: 'V-neck' }],
    });
  });

  it('generates looks successfully when styling goals and customColors are used together', async () => {
    const { app, token, userId } = await signedIn('styling-goals-custom@example.com');
    await env.db.models.UserDesignPreference.create({
      userId,
      clothingPreference: 'women',
      stylingGoals: ['taller_silhouette'],
      featurePreferences: [],
      fitPreferences: [],
      occasionPreferences: [],
    });

    const res = await request(app)
      .post('/v1/recommendations')
      .set(bearer(token))
      .send({
        occasion: 'everyday',
        wearType: ['indian'],
        customColors: ['Dusty Rose', 'Sea'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.looks.length).toBeGreaterThan(0);
  });

  it('generates looks matching the custom saved design for lehenga and dress', async () => {
    const { app, token, userId } = await signedIn('custom-designer@example.com');

    // 1. Save custom lehenga design
    await env.db.models.UserDesignSelection.create({
      userId,
      clothingPreference: 'women',
      outfitCategory: 'indian',
      garmentType: 'lehenga',
      selectedFeatures: {
        neckline: 'neckline_square_neck',
        sleeve: 'sleeve_elbow_length',
        length: 'length_floor',
        fabric: 'fabric_silk',
        silhouette: 'silhouette_empire',
        occasion: 'occasion_wedding',
      },
      savedAt: new Date(),
    });

    const lehengaRes = await request(app)
      .post('/v1/recommendations')
      .set(bearer(token))
      .send({
        occasion: 'wedding',
        design: { garmentType: 'lehenga', outfitCategory: 'indian' },
      });

    expect(lehengaRes.status).toBe(200);
    const lehengaLooks = lehengaRes.body.data.looks;
    expect(lehengaLooks.length).toBeGreaterThan(0);
    for (const look of lehengaLooks) {
      expect(look.designMatch).toEqual({ level: 'full', differs: [] });
      const lehengaSlot = look.slots.find((s: any) => s.slot === 'one_piece');
      expect(lehengaSlot).toBeDefined();
      expect(lehengaSlot.lookSpec.category).toBe('lehenga');
      expect(lehengaSlot.lookSpec.neckline).toBe('square');
      expect(lehengaSlot.lookSpec.sleeve).toBe('elbow');
      expect(lehengaSlot.lookSpec.length).toBe('floor');
      expect(lehengaSlot.lookSpec.fabric).toBe('silk');
      expect(lehengaSlot.lookSpec.silhouette).toBe('a_line');
      expect(lehengaSlot.searchPhrase).toContain('lehenga');
      expect(lehengaSlot.searchPhrase).toContain('square neck');
      expect(lehengaSlot.searchPhrase).toContain('elbow length');
      expect(lehengaSlot.searchPhrase).toContain('silk');
    }

    // 2. Save custom dress design
    await env.db.models.UserDesignSelection.create({
      userId,
      clothingPreference: 'women',
      outfitCategory: 'western',
      garmentType: 'dress',
      selectedFeatures: {
        neckline: 'neckline_sweetheart',
        sleeve: 'sleeve_short',
        length: 'length_midi',
        fabric: 'fabric_velvet',
        silhouette: 'silhouette_a_line',
        occasion: 'occasion_party',
      },
      savedAt: new Date(),
    });

    const dressRes = await request(app)
      .post('/v1/recommendations')
      .set(bearer(token))
      .send({
        occasion: 'work',
        design: { garmentType: 'dress', outfitCategory: 'western' },
      });

    expect(dressRes.status).toBe(200);
    const dressLooks = dressRes.body.data.looks;
    expect(dressLooks.length).toBeGreaterThan(0);
    for (const look of dressLooks) {
      expect(look.designMatch).toEqual({ level: 'full', differs: [] });
      const dressSlot = look.slots.find((s: any) => s.slot === 'one_piece');
      expect(dressSlot).toBeDefined();
      expect(dressSlot.lookSpec.category).toBe('dress');
      expect(dressSlot.lookSpec.neckline).toBe('sweetheart');
      expect(dressSlot.lookSpec.sleeve).toBe('short');
      expect(dressSlot.lookSpec.length).toBe('midi');
      expect(dressSlot.lookSpec.fabric).toBe('velvet');
      expect(dressSlot.lookSpec.silhouette).toBe('a_line');
      expect(dressSlot.searchPhrase).toContain('dress');
      // A dress look must not have a bottom slot (trousers/jeans)
      expect(look.slots.some((s: any) => s.slot === 'bottom')).toBe(false);
    }
  });
});
