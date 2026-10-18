import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, login, registerUser, startTestEnv, type TestEnv } from '../helpers';

// Specified collections (D-110 … D-125, DATABASE.md §3.10 – §3.14, §4a, §4b). No endpoint uses them yet;
// these tests pin the database rules the features will rely on.

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

const style = {
  styleId: 'CST-001',
  slug: 'women-tops-v-neck',
  name: 'V-neck',
  description: 'A neckline that dips to a point at the centre front.',
  department: 'women',
  categoryId: '64b000000000000000000001',
  definingAttribute: { attributeId: 'neckline', valueId: 'v_neck' },
  explanation: { summary: 'A V-neck creates a longer vertical line through the neck and torso.' },
} as const;

const rights = { source: 'team_made', creator: 'StyleMe design team', licence: 'Owned by StyleMe' } as const;

describe('shared catalogue rules', () => {
  it('refuses to publish styling content the founder has not approved (D-62)', async () => {
    await expect(env.db.models.ClothingStyle.create({ ...style, status: 'published' })).rejects.toThrow(
      /founder-approved/,
    );
    const approved = await env.db.models.ClothingStyle.create({
      ...style,
      status: 'published',
      review: { status: 'approved', approvedAt: new Date() },
    });
    expect(approved.status).toBe('published');
    await expect(
      env.db.models.Palette.create({ recordId: 'PAL-001', name: 'Warm earth', record: {}, status: 'published' }),
    ).rejects.toThrow(/founder-approved/);
  });

  it('refuses to publish an illustration without verified usage rights (D-113)', async () => {
    const asset = {
      assetId: 'ILL-001',
      kind: 'croquis' as const,
      title: 'V-neck croquis',
      altText: 'Fashion sketch of a figure in a V-neck top and white pants',
      views: [
        { view: 'front' as const, storage: 'static' as const, path: 'catalogue/ill-001.svg', format: 'svg' as const },
      ],
      figureClothing: 'plain_white_shirt_and_white_pants' as const,
      rights,
    };
    await expect(env.db.models.Illustration.create({ ...asset, status: 'published' })).rejects.toThrow(/rights/);
    const ok = await env.db.models.Illustration.create({
      ...asset,
      status: 'published',
      rights: { ...rights, verifiedAt: new Date() },
    });
    expect(ok.status).toBe('published');
  });

  it('keeps one saved record per user and identity (duplicate saves are detected)', async () => {
    await env.db.models.SavedItem.init();
    const item = {
      userId: '64b0000000000000000000aa',
      itemType: 'clothing_style',
      sourceFeature: 'outfit_categories',
      ref: { kind: 'clothing_style', id: 'CST-001' },
      identityKey: 'clothing_style:CST-001',
      name: 'V-neck',
    } as const;
    await env.db.models.SavedItem.create(item);
    await expect(env.db.models.SavedItem.create(item)).rejects.toThrow(/duplicate key/);
    await env.db.models.SavedItem.create({ ...item, userId: '64b0000000000000000000bb' });
  });
});

describe('account deletion', () => {
  it('removes saved items, collections, custom palettes, feedback and the admin record (FR-AUTH-09)', async () => {
    const { app, mail } = env.makeApp();
    await registerUser(app, env, mail, 'mo@example.com');
    const token = await login(app, 'mo@example.com');
    const userId = (await request(app).get('/v1/auth/me').set(bearer(token))).body.data.id as string;

    const collection = await env.db.models.SavedCollection.create({ userId, name: 'Office', nameKey: 'office' });
    await env.db.models.SavedItem.create({
      userId,
      itemType: 'palette',
      sourceFeature: 'my_colour_palette',
      ref: { kind: 'catalogue_palette', id: 'PAL-001' },
      identityKey: 'catalogue_palette:PAL-001',
      name: 'Warm earth',
      collectionIds: [collection._id],
    });
    await env.db.models.CustomPalette.create({
      userId,
      name: 'My festive',
      colours: [
        { hex: '#7B1E3A', role: 'primary' },
        { hex: '#D4AF37', role: 'accent' },
      ],
      basedOnPaletteId: 'PAL-001',
    });
    await env.db.models.UserFeedback.create({
      userId,
      targetType: 'clothing_style',
      targetId: 'CST-001',
      value: 'not_for_me',
      reasons: ['comfort'],
      feature: 'outfit_categories',
    });
    await env.db.models.AdminAccount.create({ userId, role: 'content_admin' });

    await request(app).post('/v1/account/deletion-otp').set(bearer(token));
    const res = await request(app)
      .delete('/v1/account')
      .set(bearer(token))
      .send({ otp: mail.otp('mo@example.com'), confirm: true });
    expect(res.status).toBe(200);

    for (const model of ['SavedItem', 'SavedCollection', 'CustomPalette', 'UserFeedback', 'AdminAccount'] as const) {
      expect(await (env.db.models[model] as typeof env.db.models.SavedItem).countDocuments(), model).toBe(0);
    }
  });
});
