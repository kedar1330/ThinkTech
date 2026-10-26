import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DesignFeaturesResponse } from '@styleme/contracts';
import { DESIGN_FEATURES } from '../../src/design/catalogue';
import { seedDesignCatalogue } from '../../src/design/seed';
import { USER_OWNED_COLLECTIONS } from '../../src/models/index';
import { DESIGN_FIXTURE_RULES } from '../fixtures/design-rules';
import { bearer, login, logTextForPrivacyChecks, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Design features (D-132, API.md §3.12): Clothing Preference decides the catalogue, approved rules decide what
// suits the user (body type, height band, goals), and preferences and selections are the user's own.

let env: TestEnv;
beforeAll(async () => {
  env = await startTestEnv();
});
afterAll(async () => {
  await env.stop();
});
beforeEach(async () => {
  await env.reset();
  await seedDesignCatalogue(env.db.models, { rules: DESIGN_FIXTURE_RULES });
});

async function signedIn(email: string, profile?: Record<string, unknown>, bodyType?: string) {
  const { app, mail } = env.makeApp();
  await registerUser(app, env, mail, email);
  const token = await login(app, email);
  if (profile) expect((await request(app).put('/v1/profile').set(bearer(token)).send(profile)).status).toBe(200);
  if (bodyType)
    expect(
      (
        await request(app)
          .put('/v1/appearance')
          .set(bearer(token))
          .send({ bodyType: { value: bodyType } })
      ).status,
    ).toBe(200);
  return { app, token };
}

const ids = (res: DesignFeaturesResponse, category: string) =>
  res.categories.find((c) => c.id === category)?.features.map((f) => f.featureId) ?? [];

describe('design catalogue', () => {
  it('stores Women and Men → outfit category → garment → feature category → feature', async () => {
    const m = env.db.models;
    expect(await m.OutfitCategory.countDocuments({ level: 'department' })).toBe(2);
    expect(await m.OutfitCategory.countDocuments({ level: 'outfit_category' })).toBe(3);
    const kurti = await m.OutfitCategory.findOne({ key: 'garment-kurti' }).lean();
    expect(kurti).toMatchObject({
      garmentKind: 'top',
      departments: ['women'],
      outfitCategories: ['indian', 'fusion'],
    });
    const kurta = await m.OutfitCategory.findOne({ key: 'garment-kurta' }).lean();
    expect(kurta).toMatchObject({
      garmentKind: 'top',
      departments: ['men'],
      outfitCategories: ['indian', 'fusion'],
    });
    expect(kurti?.featureCategoryIds).toEqual(expect.arrayContaining(['neckline', 'sleeve', 'fit']));
    expect(await m.DesignFeature.countDocuments()).toBe(DESIGN_FEATURES.length);
    // Shared records: one V-neck for both, with a picture on each figure.
    const vNeck = await m.DesignFeature.findOne({ featureId: 'neckline_v_neck' }).lean();
    expect(vNeck?.departments).toEqual(['women', 'men']);
    expect(vNeck?.illustrations.map((i) => `${i.department}:${i.role}`).sort()).toEqual([
      'men:card',
      'men:layer',
      'women:card',
      'women:layer',
    ]);
    const asset = await m.Illustration.findOne({ assetId: vNeck!.illustrations[0]!.assetId }).lean();
    expect(asset).toMatchObject({ status: 'published', rights: { source: 'code_generated' } });
    expect(await m.FeatureCombination.countDocuments({ kind: 'incompatible' })).toBeGreaterThan(0);
  });

  it('#163 archives design pictures the generator no longer makes, and back designs list no picture', async () => {
    await env.db.models.Illustration.create({
      assetId: 'ILL-9999',
      kind: 'design_feature',
      title: 'Stale back picture',
      altText: 'A picture whose file no longer exists.',
      views: [
        { view: 'front', storage: 'static', path: '/illustrations/design/women-neckline-gone_back.svg', format: 'svg' },
      ],
      rights: {
        source: 'code_generated',
        creator: 'StyleMe',
        licence: 'StyleMe proprietary',
        allowedUsage: ['outfit_categories'],
        verifiedAt: new Date(),
      },
      status: 'published',
    });
    await seedDesignCatalogue(env.db.models, { rules: DESIGN_FIXTURE_RULES });
    expect((await env.db.models.Illustration.findOne({ assetId: 'ILL-9999' }).lean())?.status).toBe('archived');
    const back = await env.db.models.DesignFeature.findOne({ featureId: 'neckline_deep_u_back' }).lean();
    expect(back?.illustrations).toEqual([]);
    const front = await env.db.models.DesignFeature.findOne({ featureId: 'neckline_v_neck' }).lean();
    expect((front?.illustrations ?? []).length).toBeGreaterThan(0);
  });

  it('activates only approved rules; a draft cannot be active', async () => {
    expect(await env.db.models.FeatureSuitabilityRule.countDocuments({ status: 'active' })).toBe(
      DESIGN_FIXTURE_RULES.length,
    );
    await expect(
      env.db.models.FeatureSuitabilityRule.create({
        ruleId: 'FSR-999',
        featureId: 'neckline_v_neck',
        featureCategory: 'neckline',
        recommendation: { result: 'recommended', reason: 'Draft only.' },
        status: 'active',
        reviewStatus: 'draft',
      }),
    ).rejects.toThrow(/founder-approved/);
  });

  it('lists the user-owned collections for account deletion', () => {
    expect(USER_OWNED_COLLECTIONS).toEqual(expect.arrayContaining(['userDesignPreferences', 'userDesignSelections']));
  });
});

describe('GET /v1/design/taxonomy and /v1/design/features', () => {
  it('follows the Clothing Preference: Women’s Wear sees only women’s garments and features', async () => {
    const { app, token } = await signedIn('ana@example.com', { department: 'women' });
    const tax = await request(app).get('/v1/design/taxonomy').set(bearer(token));
    expect(tax.status).toBe(200);
    expect(tax.body.data.department).toBe('women');
    expect(tax.body.data.canSwitchDepartment).toBe(false);
    const indian = tax.body.data.outfitCategories.find((c: { id: string }) => c.id === 'indian');
    const garments = indian.garmentTypes.map((g: { id: string }) => g.id);
    expect(garments).toEqual(expect.arrayContaining(['kurti', 'anarkali', 'saree_blouse']));
    expect(garments).not.toContain('sherwani');
    expect(garments).not.toContain('kurta');

    // Asking for men's is ignored: the profile decides.
    const res = await request(app)
      .get('/v1/design/features?garmentType=kurti&department=men&view=all')
      .set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data.department).toBe('women');
    expect(ids(res.body.data, 'neckline')).toContain('neckline_sweetheart');
    expect(ids(res.body.data, 'neckline')).not.toContain('neckline_spread_collar');
    expect(ids(res.body.data, 'neckline')).not.toContain('neckline_not_applicable');
    expect(res.body.data.baseFigure.url).toBe('/illustrations/design/women-base.svg');
    const vNeck = res.body.data.categories[0].features.find(
      (f: { featureId: string }) => f.featureId === 'neckline_v_neck',
    );
    expect(vNeck.image.url).toBe('/illustrations/design/women-neckline-v_neck.svg');
    expect(vNeck.layer.url).toBe('/illustrations/design/women-layer-neckline-v_neck.svg');

    // A sherwani is not a women's garment.
    const other = await request(app).get('/v1/design/features?garmentType=sherwani').set(bearer(token));
    expect(other.status).toBe(404);
  });

  it('shows only what suits the user, from body type and height band, with reasons', async () => {
    const { app, token } = await signedIn('bea@example.com', { department: 'women', heightCm: 152 }, 'pear');
    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect(res.status).toBe(200);
    const data = res.body.data as DesignFeaturesResponse;
    expect(data.basis).toEqual({ bodyType: true, heightBand: 'petite', stylingGoals: 0 });
    const necklines = data.categories.find((c) => c.id === 'neckline')!;
    expect(necklines.personalised).toBe(true);
    // Recommended first, then alternatives; boat neck (not preferred) and unranked necklines are hidden.
    expect(necklines.features.map((f) => f.featureId)).toEqual([
      'neckline_v_neck',
      'neckline_square_neck',
      'neckline_scoop_neck',
    ]);
    expect(necklines.features[0]!.suitability).toEqual({
      result: 'recommended',
      reasons: ['Fixture reason for neckline_v_neck.'],
    });
    // Petite: bishop is not preferred, three-quarter recommended.
    expect(ids(data, 'sleeve')).toEqual(['sleeve_three_quarter']);
    // No approved rule speaks to fit yet: everything is shown, unranked.
    const fit = data.categories.find((c) => c.id === 'fit')!;
    expect(fit.personalised).toBe(false);
    expect(fit.features.length).toBeGreaterThan(5);

    // "Show all" keeps everything, with the less preferred options last.
    const all = await request(app).get('/v1/design/features?garmentType=kurti&view=all').set(bearer(token));
    const allNecklines = ids(all.body.data, 'neckline');
    expect(allNecklines[0]).toBe('neckline_v_neck');
    expect(allNecklines.at(-1)).toBe('neckline_boat_neck');
  });

  it('stores the personalised result in the user’s design preferences, without the height or body type', async () => {
    const { app, token } = await signedIn('cy@example.com', { department: 'women', heightCm: 152 }, 'pear');
    await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    const doc = await env.db.models.UserDesignPreference.findOne().lean();
    expect(doc?.personalised).toHaveLength(1);
    const snap = doc!.personalised[0]!;
    expect(snap).toMatchObject({ garmentType: 'kurti', department: 'women' });
    expect(snap.features.find((f) => f.featureId === 'neckline_boat_neck')).toMatchObject({
      result: 'not_preferred',
      ruleIds: ['FSR-903'],
    });
    // IDs and timestamps are left out: a random ObjectId or a time like `.152Z` can contain "152".
    const raw = JSON.stringify(doc, (key, value: unknown) => (/^_id$|Id$|At$/.test(key) ? undefined : value));
    expect(raw).not.toContain('152');
    expect(raw).not.toContain('pear');
    expect(raw).not.toContain('petite');

    // Unchanged inputs: not rewritten. A new goal: recomputed.
    const before = snap.computedAt;
    await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect((await env.db.models.UserDesignPreference.findOne().lean())!.personalised[0]!.computedAt).toEqual(before);
    await request(app)
      .put('/v1/design/preferences')
      .set(bearer(token))
      .send({ stylingGoals: ['add_structure'] });
    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    // The goal rule (priority 1) outranks the height rule for the bishop sleeve.
    expect(ids(res.body.data, 'sleeve')).toEqual(['sleeve_three_quarter', 'sleeve_bishop']);
  });

  it('ignores the body type when appearance signals are turned off', async () => {
    const { app, token } = await signedIn('di@example.com', { department: 'women' }, 'pear');
    await request(app).put('/v1/appearance').set(bearer(token)).send({ useInRecommendations: false });
    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect(res.body.data.basis.bodyType).toBe(false);
    expect(res.body.data.categories.find((c: { id: string }) => c.id === 'neckline').personalised).toBe(false);
  });

  it('Men’s Wear gets men’s collars and figure', async () => {
    const { app, token } = await signedIn('ed@example.com', { department: 'men' }, 'triangle');
    const res = await request(app).get('/v1/design/features?garmentType=shirt').set(bearer(token));
    expect(res.status).toBe(200);
    expect(ids(res.body.data, 'neckline')).toEqual(['neckline_spread_collar']);
    expect(res.body.data.baseFigure.url).toBe('/illustrations/design/men-base.svg');
    const all = await request(app).get('/v1/design/features?garmentType=shirt&view=all').set(bearer(token));
    expect(ids(all.body.data, 'neckline')).not.toContain('neckline_sweetheart');
  });

  it('asks for a choice when the profile has no Clothing Preference', async () => {
    const { app, token } = await signedIn('fi@example.com');
    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect(res.status).toBe(400);
    const ok = await request(app).get('/v1/design/features?garmentType=kurta&department=men').set(bearer(token));
    expect(ok.status).toBe(200);
    expect(ok.body.data.department).toBe('men');
  });

  it('requires authentication', async () => {
    const { app } = env.makeApp();
    expect((await request(app).get('/v1/design/features?garmentType=kurti')).status).toBe(401);
  });
});

describe('preferences and selections', () => {
  it('likes always show, dislikes hide, and no_preference clears', async () => {
    const { app, token } = await signedIn('gu@example.com', { department: 'women' }, 'pear');
    const put = await request(app)
      .put('/v1/design/preferences')
      .set(bearer(token))
      .send({
        featurePreferences: [
          { featureId: 'neckline_halter', preference: 'liked' },
          { featureId: 'neckline_v_neck', preference: 'disliked' },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.data.featurePreferences).toEqual(
      expect.arrayContaining([{ featureId: 'neckline_halter', featureCategory: 'neckline', preference: 'liked' }]),
    );
    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect(ids(res.body.data, 'neckline')).toEqual(['neckline_square_neck', 'neckline_halter']);

    await request(app)
      .put('/v1/design/preferences')
      .set(bearer(token))
      .send({ featurePreferences: [{ featureId: 'neckline_v_neck', preference: 'no_preference' }] });
    const after = await request(app).get('/v1/design/preferences').set(bearer(token));
    expect(after.body.data.featurePreferences).toHaveLength(1);

    const bad = await request(app)
      .put('/v1/design/preferences')
      .set(bearer(token))
      .send({ featurePreferences: [{ featureId: 'neckline_made_up', preference: 'liked' }] });
    expect(bad.status).toBe(400);
    const wrong = await request(app)
      .put('/v1/design/preferences')
      .set(bearer(token))
      .send({ fitPreferences: ['neckline_v_neck'] });
    expect(wrong.status).toBe(400);
  });

  it('saves the customizer selection (Square Neck + Full-length sleeve) and rebuilds it', async () => {
    const { app, token } = await signedIn('ha@example.com', { department: 'women' });
    const body = {
      garmentType: 'kurti',
      outfitCategory: 'indian',
      selectedFeatures: { neckline: 'neckline_square_neck', sleeve: 'sleeve_full_length', fit: 'fit_a_line' },
      customization: { necklineDepth: 'medium', sleeveLength: 'full' },
    };
    const put = await request(app).put('/v1/design/selections').set(bearer(token)).send(body);
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({
      garmentType: 'kurti',
      department: 'women',
      selectedFeatures: body.selectedFeatures,
    });

    const res = await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    expect(res.body.data.selection.selectedFeatures).toEqual(body.selectedFeatures);
    expect((await request(app).get('/v1/design/selections').set(bearer(token))).body.data).toHaveLength(1);

    // Saving again replaces it: one selection per garment.
    await request(app)
      .put('/v1/design/selections')
      .set(bearer(token))
      .send({ ...body, selectedFeatures: { neckline: 'neckline_v_neck' } });
    expect(await env.db.models.UserDesignSelection.countDocuments()).toBe(1);

    expect((await request(app).delete('/v1/design/selections/kurti').set(bearer(token))).status).toBe(200);
    expect(await env.db.models.UserDesignSelection.countDocuments()).toBe(0);
  });

  it('rejects impossible or mismatched selections', async () => {
    const { app, token } = await signedIn('io@example.com', { department: 'women' });
    const send = (selectedFeatures: Record<string, string>, extra: Record<string, unknown> = {}) =>
      request(app)
        .put('/v1/design/selections')
        .set(bearer(token))
        .send({ garmentType: 'kurti', outfitCategory: 'indian', selectedFeatures, ...extra });
    expect((await send({ neckline: 'neckline_strapless', sleeve: 'sleeve_full_length' })).status).toBe(400);
    expect((await send({ neckline: 'sleeve_bishop' })).status).toBe(400); // wrong category
    expect((await send({ neckline: 'neckline_spread_collar' })).status).toBe(400); // men's only
    expect((await send({ neckline: 'neckline_not_applicable' })).status).toBe(400); // not selectable
    expect((await send({ neckline: 'neckline_v_neck' }, { outfitCategory: 'western' })).status).toBe(400);
    expect((await send({ leg_shape: 'leg_shape_slim' })).status).toBe(400); // not on a kurti
  });

  it('logs no feature choices or profile values', async () => {
    const { app, token } = await signedIn('jo@example.com', { department: 'women', heightCm: 152 }, 'pear');
    await request(app)
      .put('/v1/design/selections')
      .set(bearer(token))
      .send({ garmentType: 'kurti', outfitCategory: 'indian', selectedFeatures: { neckline: 'neckline_sweetheart' } });
    await request(app).get('/v1/design/features?garmentType=kurti').set(bearer(token));
    const logs = logTextForPrivacyChecks(env.logLines);
    expect(logs).not.toContain('neckline_sweetheart');
    expect(logs).not.toMatch(/\bpear\b/);
  });
});
