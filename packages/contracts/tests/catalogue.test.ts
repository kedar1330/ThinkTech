import { describe, expect, it } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  BODY_SHAPES,
  CUSTOM_PALETTE_LIMITS,
  GARMENT_ATTRIBUTES,
  PROPORTION_DESCRIPTOR_IDS,
  USER_FEEDBACK_REASON_IDS,
  auditChangeSchema,
  clothingStyleIdSchema,
  customPaletteSchema,
  hasAdminPermission,
  hexColourSchema,
  illustrationIdSchema,
} from '../src';

// Shared catalogue, saved items and admin contracts (D-109 … D-128). Specified; no endpoint uses them yet.

describe('catalogue contracts', () => {
  it('accepts stable catalogue IDs only', () => {
    expect(clothingStyleIdSchema.safeParse('CST-001').success).toBe(true);
    expect(clothingStyleIdSchema.safeParse('CST-1').success).toBe(false);
    expect(illustrationIdSchema.safeParse('ILL-0420').success).toBe(true);
    expect(illustrationIdSchema.safeParse('ill-001').success).toBe(false);
  });

  it('maps every body shape to an existing proportion descriptor, or none for "Not sure"', () => {
    for (const shape of BODY_SHAPES) {
      if (shape.id === 'not_sure') expect(shape.proportion).toBeNull();
      else expect(PROPORTION_DESCRIPTOR_IDS).toContain(shape.proportion);
      expect(shape.departments.length).toBeGreaterThan(0);
    }
    const ids = BODY_SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a vocabulary list for each attribute that already has one', () => {
    const withValues = GARMENT_ATTRIBUTES.filter((a) => a.values !== null).map((a) => a.id);
    expect(withValues).toEqual(
      expect.arrayContaining(['neckline', 'sleeve_length', 'length', 'fit', 'silhouette', 'fabric', 'pattern']),
    );
  });

  it('normalises HEX codes and rejects anything else', () => {
    expect(hexColourSchema.parse('#a1b2c3')).toBe('#A1B2C3');
    expect(hexColourSchema.safeParse('a1b2c3').success).toBe(false);
    expect(hexColourSchema.safeParse('#abc').success).toBe(false);
  });

  it('limits custom palettes to 2 – 12 colours with a role each', () => {
    const colour = { hex: '#112233', role: 'primary' as const };
    expect(customPaletteSchema.safeParse({ name: 'Mine', colours: [colour] }).success).toBe(false);
    expect(customPaletteSchema.safeParse({ name: 'Mine', colours: [colour, colour] }).success).toBe(true);
    const tooMany = Array.from({ length: CUSTOM_PALETTE_LIMITS.maxColours + 1 }, () => colour);
    expect(customPaletteSchema.safeParse({ name: 'Mine', colours: tooMany }).success).toBe(false);
    expect(
      customPaletteSchema.safeParse({ name: 'Mine', colours: [colour, colour], basedOnPaletteId: 'PAL-001' }).success,
    ).toBe(true);
  });

  it('keeps feedback reasons unique', () => {
    expect(new Set(USER_FEEDBACK_REASON_IDS).size).toBe(USER_FEEDBACK_REASON_IDS.length);
  });
});

describe('admin contracts', () => {
  it('gives the Super Admin every permission', () => {
    for (const permission of ADMIN_PERMISSIONS) expect(hasAdminPermission('super_admin', permission)).toBe(true);
  });

  it('never lets a Content Admin manage admins, users, audit logs or styling approval', () => {
    for (const permission of [
      'admins.manage',
      'users.suspend',
      'users.view_limited',
      'users.request_deletion',
      'audit.view',
      'catalogue.approve_styling',
    ] as const) {
      expect(hasAdminPermission('content_admin', permission)).toBe(false);
    }
    expect(hasAdminPermission('content_admin', 'catalogue.edit')).toBe(true);
  });

  it('keeps audit change summaries short and free of nested data', () => {
    expect(auditChangeSchema.safeParse({ field: 'status', from: 'draft', to: 'published' }).success).toBe(true);
    expect(auditChangeSchema.safeParse({ field: 'colours', to: { hex: '#000000' } }).success).toBe(false);
    expect(auditChangeSchema.safeParse({ field: 'name', to: 'x'.repeat(201) }).success).toBe(false);
  });
});
