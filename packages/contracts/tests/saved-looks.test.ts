import { describe, expect, it } from 'vitest';
import { outfitListQuerySchema, outfitListResponseSchema } from '../src';

// Saved looks list (FR-OUT-02, API.md §3.5 #14, issue #41).

type Schema = { safeParse: (value: unknown) => { success: boolean } };
const ok = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(true);
const bad = (schema: Schema, value: unknown) => expect(schema.safeParse(value).success).toBe(false);

const look = (id: string, status: 'suggested' | 'saved' = 'saved') => ({
  id,
  status,
  templateId: 'OUT-001',
  paletteId: 'PAL-001',
  slots: [
    {
      slotId: 'top',
      slot: 'top',
      lookSpec: { category: 'kurta', colorFamily: 'blue', colorId: 'navy' },
      swatches: [{ colorId: 'navy', name: 'Navy', hex: '#1F2A44' }],
      searchPhrase: 'navy kurta',
      sizeNote: 'Your saved size: M',
      alternatives: [],
    },
  ],
  explanation: 'Navy keeps it calm.',
  explanationRefs: { ruleIds: ['STY-001'], attributes: [] },
  combinationSignature: 'abc123',
  aiModel: null,
});

describe('GET /v1/outfits query', () => {
  it('lists saved looks by default, 20 per page', () => {
    expect(outfitListQuerySchema.parse({})).toEqual({ status: 'saved', page: 1, limit: 20 });
    expect(outfitListQuerySchema.parse({ status: 'suggested', page: '2', limit: '5' })).toEqual({
      status: 'suggested',
      page: 2,
      limit: 5,
    });
  });

  it('rejects unknown statuses and out-of-range pages', () => {
    bad(outfitListQuerySchema, { status: 'archived' });
    bad(outfitListQuerySchema, { limit: '51' });
    bad(outfitListQuerySchema, { page: '0' });
  });
});

describe('GET /v1/outfits response', () => {
  it('accepts a page of looks with the total', () => {
    ok(outfitListResponseSchema, {
      looks: [look('64b7f0c2a1b2c3d4e5f60718'), look('64b7f0c2a1b2c3d4e5f60719', 'suggested')],
      page: 1,
      limit: 20,
      total: 2,
    });
    ok(outfitListResponseSchema, { looks: [], page: 3, limit: 20, total: 41 });
  });

  it('rejects extra fields, a missing total and more looks than the limit', () => {
    bad(outfitListResponseSchema, { looks: [], page: 1, limit: 20, total: 0, next: 2 });
    bad(outfitListResponseSchema, { looks: [], page: 1, limit: 20 });
    bad(outfitListResponseSchema, {
      looks: [look('64b7f0c2a1b2c3d4e5f60718'), look('64b7f0c2a1b2c3d4e5f60719')],
      page: 1,
      limit: 1,
      total: 2,
    });
    bad(outfitListResponseSchema, {
      looks: [{ ...look('64b7f0c2a1b2c3d4e5f60718'), price: 100 }],
      page: 1,
      limit: 20,
      total: 1,
    });
  });
});
