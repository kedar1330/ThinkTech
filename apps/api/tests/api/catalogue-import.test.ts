import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CatalogueImportError, importStyleLibrary } from '../../src/services/catalogue-import';
import { buildFixtureLibrary, fixturePalette, fixtureStylingRule } from '../fixtures/style-library';
import { startTestEnv, type TestEnv } from '../helpers';

// T-80: importing the style-rules files into MongoDB (TD-FS-CAT-01, D-110).

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

const DRAFT = { reviewStatus: 'draft', reviewedBy: null, reviewedAt: null } as const;
const options = { allowFixtures: true } as const;

describe('catalogue import (T-80)', () => {
  it('imports approved records as published, and a second run changes nothing', async () => {
    const library = buildFixtureLibrary({ palettes: 3, templates: 2, stylingRules: 2, fabricRules: 1 });
    const first = await importStyleLibrary(env.db.models, library, options);
    expect(first.palettes).toEqual({ created: 3, updated: 0, unchanged: 0, keptPublished: 0 });
    expect(first.templates.created).toBe(2);

    const second = await importStyleLibrary(env.db.models, library, options);
    expect(second.palettes).toEqual({ created: 0, updated: 0, unchanged: 3, keptPublished: 0 });
    expect(await env.db.models.Palette.countDocuments()).toBe(3);

    const palette = await env.db.models.Palette.findOne({ recordId: 'PAL-001' }).lean();
    expect(palette?.status).toBe('published');
    expect(palette?.review?.status).toBe('approved');
    expect(palette?.facets?.colorIds?.length).toBeGreaterThan(0);
    const template = await env.db.models.OutfitTemplate.findOne({ recordId: 'OUT-001' }).lean();
    expect(template?.facets?.garmentTypes?.length).toBeGreaterThan(0);
  });

  it('updates a record only when its version is higher', async () => {
    await importStyleLibrary(env.db.models, lib([fixturePalette(1)]), options);
    const result = await importStyleLibrary(
      env.db.models,
      lib([fixturePalette(1, { version: 2, name: 'Renamed fixture' })]),
      options,
    );
    expect(result.palettes.updated).toBe(1);
    const stored = await env.db.models.Palette.findOne({ recordId: 'PAL-001' }).lean();
    expect(stored?.version).toBe(2);
    expect(stored?.name).toBe('Renamed fixture');
  });

  it('skips drafts by default and never publishes them with --include-drafts', async () => {
    const library = lib([fixturePalette(1), fixturePalette(2, DRAFT)]);
    const approvedOnly = await importStyleLibrary(env.db.models, library, options);
    expect(approvedOnly.palettes.created).toBe(1);

    await importStyleLibrary(env.db.models, library, { ...options, includeDrafts: true });
    const draft = await env.db.models.Palette.findOne({ recordId: 'PAL-002' }).lean();
    expect(draft?.status).toBe('draft');
    expect(draft?.publishedAt).toBeNull();
  });

  it('never replaces a published record with an unapproved one', async () => {
    await importStyleLibrary(env.db.models, lib([fixturePalette(1)]), options);
    const result = await importStyleLibrary(env.db.models, lib([fixturePalette(1, { version: 2, ...DRAFT })]), {
      ...options,
      includeDrafts: true,
    });
    expect(result.palettes.keptPublished).toBe(1);
    const stored = await env.db.models.Palette.findOne({ recordId: 'PAL-001' }).lean();
    expect(stored?.status).toBe('published');
    expect(stored?.version).toBe(1);
  });

  it('writes nothing when a record fails the schema or linter', async () => {
    const broken = lib([fixturePalette(1)], [fixtureStylingRule(1, { effect: { prefer: [], weight: 0.5 } })]);
    await expect(importStyleLibrary(env.db.models, broken, options)).rejects.toBeInstanceOf(CatalogueImportError);
    expect(await env.db.models.Palette.countDocuments()).toBe(0);
  });

  it('refuses fixture records unless they are explicitly allowed', async () => {
    await expect(importStyleLibrary(env.db.models, lib([fixturePalette(1)]))).rejects.toThrow(/FIXTURE_RECORD/);
  });
});

function lib(palettes: unknown[], stylingRules: unknown[] = []) {
  return { palettes, stylingRules, fabricRules: [], templates: [] };
}
