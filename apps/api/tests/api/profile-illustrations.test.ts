import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MEASUREMENT_ORDER } from '@styleme/contracts';
import { profileIllustrations, seedProfileIllustrations } from '../../src/services/profile-illustrations';
import { startTestEnv, type TestEnv } from '../helpers';

// My Profile illustrations (D-129): generated SVGs, committed under the web app's public folder and recorded
// in the `illustrations` collection.

const WEB_PUBLIC = resolve(dirname(fileURLToPath(import.meta.url)), '../../../web/public');

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

describe('My Profile illustrations (D-129)', () => {
  it('has one guide per measurement and Clothing Preference, plus four undertone hands', () => {
    const records = profileIllustrations();
    const measurements =
      [...MEASUREMENT_ORDER.women.body_type, ...MEASUREMENT_ORDER.women.fit].length +
      [...MEASUREMENT_ORDER.men.body_type, ...MEASUREMENT_ORDER.men.fit].length;
    expect(records.filter((r) => r.kind === 'measurement_guide')).toHaveLength(measurements);
    expect(records.filter((r) => r.kind === 'undertone_guide')).toHaveLength(4);
    expect(new Set(records.map((r) => r.assetId)).size).toBe(records.length);
  });

  it('the committed SVG files match the generator (run `illustrations:generate` after changing it)', async () => {
    for (const r of profileIllustrations()) {
      expect(await readFile(join(WEB_PUBLIC, r.path), 'utf8'), r.path).toBe(r.svg);
    }
  });

  it('seeds published records with code-generated rights, safely re-runnable', async () => {
    await seedProfileIllustrations(env.db.models);
    const { upserted } = await seedProfileIllustrations(env.db.models);
    expect(await env.db.models.Illustration.countDocuments()).toBe(upserted);
    const waist = await env.db.models.Illustration.findOne({ assetId: 'ILL-1103' }).lean();
    expect(waist).toMatchObject({
      kind: 'measurement_guide',
      status: 'published',
      figureClothing: 'plain_white_shirt_and_white_pants',
      rights: { source: 'code_generated' },
      views: [{ storage: 'static', path: '/illustrations/profile/measure-women-waist.svg', format: 'svg' }],
    });
    expect(waist?.altText).toMatch(/narrowest part of your waist/);
  });
});
