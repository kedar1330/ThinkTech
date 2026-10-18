import { describe, expect, it } from 'vitest';
import { DRAFT_LIBRARY, checkDraftLibrary } from '../../scripts/draft-library';
import { SHIPPED_LIBRARY, lintLibrary, loadStyleLibrary, type RawLibrary } from '../../src/style-rules';
import { fixturePalette, fixtureTemplate } from '../fixtures/style-library';

// Draft styling content lives in apps/api/style-rules-drafts/ until the founder approves it
// (CONTRIBUTING.md §6, D-62). These tests keep it out of the shipped library and keep it valid.

const DRAFT = { reviewStatus: 'draft', reviewedBy: null, reviewedAt: null } as const;

function library(parts: Partial<RawLibrary> = {}): RawLibrary {
  return { palettes: [], stylingRules: [], fabricRules: [], templates: [], ...parts };
}

function records(raw: RawLibrary) {
  return [...raw.palettes, ...raw.stylingRules, ...raw.fabricRules, ...raw.templates] as Array<{
    id: string;
    reviewStatus: string;
  }>;
}

describe('shipped library and draft content', () => {
  it('the shipped library loads as the API does at startup', () => {
    expect(() => loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: 'production' })).not.toThrow();
  });

  it('no draft record is in the shipped library or the loaded runtime set', () => {
    const shippedIds = new Set(records(SHIPPED_LIBRARY).map((r) => r.id));
    const loaded = loadStyleLibrary(SHIPPED_LIBRARY, { appEnv: 'production' });
    for (const draft of records(DRAFT_LIBRARY)) {
      expect(shippedIds.has(draft.id), draft.id).toBe(false);
      expect(loaded.getPalette(draft.id) ?? loaded.getTemplate(draft.id) ?? loaded.getRule(draft.id)).toBeUndefined();
    }
  });

  it('every record in the drafts folder is still a draft or reviewed, never approved', () => {
    for (const draft of records(DRAFT_LIBRARY)) {
      expect(['draft', 'reviewed'], draft.id).toContain(draft.reviewStatus);
    }
  });

  it('the drafts pass every linter check except the expected NOT_APPROVED', () => {
    const result = checkDraftLibrary(SHIPPED_LIBRARY, DRAFT_LIBRARY);
    expect(result.issues).toEqual([]);
    expect(result.awaitingApproval).toBe(records(DRAFT_LIBRARY).length);
  });
});

describe('draft check (style-rules drafts)', () => {
  const check = (drafts: RawLibrary, shipped: RawLibrary = library()) =>
    checkDraftLibrary(shipped, drafts, { allowFixtures: true });

  it('accepts a valid draft and counts it as awaiting approval', () => {
    const result = check(library({ palettes: [fixturePalette(1, DRAFT)] }));
    expect(result).toEqual({ issues: [], awaitingApproval: 1 });
  });

  it('the same draft in the shipped library still fails the shipped lint', () => {
    const shipped = library({ palettes: [fixturePalette(1, DRAFT)] });
    expect(lintLibrary(shipped, { allowFixtures: true }).issues.map((i) => i.code)).toEqual(['NOT_APPROVED']);
  });

  it('fails on a schema error in a draft', () => {
    const result = check(library({ palettes: [fixturePalette(1, { ...DRAFT, neutrals: ['not_a_colour'] })] }));
    expect(result.issues.map((i) => i.code)).toContain('INVALID_SCHEMA');
  });

  it('fails on a draft that references a record that does not exist', () => {
    const template = fixtureTemplate(1, { ...DRAFT, compatiblePalettes: ['PAL-999'] });
    const result = check(library({ palettes: [fixturePalette(1, DRAFT)], templates: [template] }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'UNKNOWN_REFERENCE', recordId: 'OUT-001' }));
  });

  it('fails on a draft whose ID is already used by a shipped record', () => {
    const result = check(library({ palettes: [fixturePalette(1, DRAFT)] }), library({ palettes: [fixturePalette(1)] }));
    expect(result.issues.map((i) => i.code)).toContain('DUPLICATE_ID');
  });

  it('fails on an approved record left in the drafts folder', () => {
    const result = check(library({ palettes: [fixturePalette(1)] }));
    expect(result.issues).toEqual([expect.objectContaining({ code: 'NOT_A_DRAFT', recordId: 'PAL-001' })]);
  });
});
