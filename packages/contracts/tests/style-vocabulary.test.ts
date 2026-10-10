import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_GROUPS,
  CATEGORY_GROUP_IDS,
  COLORS,
  COLOR_FAMILY_IDS,
  COMFORT_OPTIONS,
  CONTRAST_LEVELS,
  CONTRAST_PREFERENCES,
  DEPARTMENTS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  MONK_TONES,
  NECKLINES,
  NECKLINE_DEPTHS,
  OCCASIONS,
  PATTERNS,
  PATTERN_SCALES,
  PROPORTION_DESCRIPTORS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  SLOT_TYPES,
  SLOT_TYPE_IDS,
  STYLES,
  UNDERTONES,
  UNDERTONE_AFFINITIES,
  COLOR_FAMILIES,
  categorySchema,
  colorIdSchema,
  departmentSchema,
  monkRangeSchema,
  occasionSchema,
} from '../src/index';

const VOCABULARIES = {
  DEPARTMENTS,
  OCCASIONS,
  STYLES,
  SLOT_TYPES,
  CATEGORY_GROUPS,
  CATEGORIES,
  COLOR_FAMILIES,
  COLORS,
  FABRICS,
  SILHOUETTES,
  FITS,
  NECKLINES,
  PATTERNS,
  PATTERN_SCALES,
  SLEEVE_LENGTHS,
  GARMENT_LENGTHS,
  NECKLINE_DEPTHS,
  COMFORT_OPTIONS,
  CONTRAST_LEVELS,
  CONTRAST_PREFERENCES,
  UNDERTONES,
  UNDERTONE_AFFINITIES,
  PROPORTION_DESCRIPTORS,
} as const;

// IDs that may already be stored. Stability means none of these may be renamed or removed; new IDs
// may be added freely. When adding an ID, add it here too so it is protected from then on.
const STABLE_IDS: Record<keyof typeof VOCABULARIES, string[]> = {
  DEPARTMENTS: ['women', 'men', 'any'],
  OCCASIONS: ['everyday', 'work', 'festive', 'wedding', 'party', 'date', 'travel', 'formal'],
  STYLES: ['classic', 'minimal', 'casual', 'smart_casual', 'traditional', 'fusion', 'streetwear', 'boho'],
  SLOT_TYPES: ['top', 'bottom', 'one_piece', 'layer', 'footwear', 'accessory'],
  CATEGORY_GROUPS: ['tops', 'bottoms', 'ethnicTops', 'ethnicSets', 'freeSize', 'shoes', 'dresses'],
  CATEGORIES: [
    't_shirt',
    'shirt',
    'jeans',
    'trousers',
    'kurta',
    'kurti',
    'lehenga',
    'saree',
    'shoes',
    'accessory',
    'dress',
  ],
  COLOR_FAMILIES: ['neutral', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'metallic'],
  COLORS: [
    'white',
    'ivory',
    'cream',
    'beige',
    'taupe',
    'grey',
    'charcoal',
    'black',
    'camel',
    'tan',
    'chocolate',
    'rust',
    'red',
    'maroon',
    'blush',
    'rose_pink',
    'fuchsia',
    'peach',
    'coral',
    'orange',
    'mustard',
    'pastel_yellow',
    'mint',
    'sage',
    'olive',
    'emerald',
    'bottle_green',
    'sky_blue',
    'powder_blue',
    'denim_blue',
    'royal_blue',
    'teal',
    'navy',
    'lavender',
    'purple',
    'plum',
    'gold',
    'silver',
    'rose_gold',
  ],
  FABRICS: [
    'cotton',
    'linen',
    'khadi',
    'silk',
    'chanderi',
    'georgette',
    'chiffon',
    'crepe',
    'rayon',
    'satin',
    'velvet',
    'wool',
    'denim',
    'jersey_knit',
    'polyester_blend',
    'leather',
    'vegan_leather',
  ],
  SILHOUETTES: ['fitted', 'straight', 'a_line', 'flared', 'relaxed', 'tapered', 'wide_leg', 'oversized', 'wrap'],
  FITS: ['slim', 'regular', 'relaxed'],
  NECKLINES: ['round', 'v_neck', 'collared', 'mandarin', 'boat', 'square', 'sweetheart', 'high_neck'],
  PATTERNS: [
    'solid',
    'stripes',
    'checks',
    'floral',
    'geometric',
    'paisley',
    'polka_dots',
    'block_print',
    'ikat',
    'bandhani',
    'embroidered',
    'abstract',
  ],
  PATTERN_SCALES: ['small', 'medium', 'large'],
  SLEEVE_LENGTHS: ['sleeveless', 'cap', 'short', 'elbow', 'three_quarter', 'full'],
  GARMENT_LENGTHS: ['cropped', 'waist', 'hip', 'thigh', 'knee', 'midi', 'ankle', 'floor'],
  NECKLINE_DEPTHS: ['deep', 'moderate', 'high'],
  COMFORT_OPTIONS: ['stretch', 'loose_fit', 'lightweight', 'breathable', 'easy_care', 'flat_footwear'],
  CONTRAST_LEVELS: ['low', 'medium', 'high'],
  CONTRAST_PREFERENCES: ['low', 'medium', 'high', 'no_preference'],
  UNDERTONES: ['warm', 'cool', 'neutral', 'olive', 'not_sure'],
  UNDERTONE_AFFINITIES: ['warm', 'cool', 'neutral', 'olive', 'any'],
  PROPORTION_DESCRIPTORS: [
    'shoulders_wider_than_hips',
    'hips_wider_than_shoulders',
    'balanced_defined_waist',
    'balanced_straight_waist',
    'fuller_midsection',
    'prefer_not_to_say',
  ],
};

// Order matters for these lists: coverage is compared by index ("at least elbow length").
const ORDERED = ['SLEEVE_LENGTHS', 'GARMENT_LENGTHS', 'NECKLINE_DEPTHS', 'PATTERN_SCALES'] as const;

describe('style vocabulary', () => {
  for (const [name, items] of Object.entries(VOCABULARIES)) {
    describe(name, () => {
      const idList = items.map((item) => item.id);

      it('has unique, well-formed IDs and non-empty labels', () => {
        expect(new Set(idList).size).toBe(idList.length);
        for (const item of items) {
          expect(item.id).toMatch(/^[a-z][a-zA-Z0-9_]*$/);
          expect(item.label.trim()).not.toBe('');
        }
      });

      it('keeps every recorded ID (IDs are never renamed or removed)', () => {
        const recorded = STABLE_IDS[name as keyof typeof VOCABULARIES];
        expect(idList).toEqual(expect.arrayContaining(recorded));
        // New IDs must be recorded too, so they are protected from the next change on.
        expect(recorded).toEqual(expect.arrayContaining(idList));
      });
    });
  }

  it('keeps the order of ordered lists', () => {
    for (const name of ORDERED) {
      expect(VOCABULARIES[name].map((item) => item.id)).toEqual(STABLE_IDS[name]);
    }
  });

  it('every category references a known group, slot type and concrete department', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_GROUP_IDS).toContain(category.group);
      expect(SLOT_TYPE_IDS).toContain(category.slotType);
      expect(category.departments.length).toBeGreaterThan(0);
      for (const department of category.departments) expect(department).not.toBe('any');
    }
  });

  it('every colour has a known family and a 6-digit hex swatch', () => {
    for (const color of COLORS) {
      expect(COLOR_FAMILY_IDS).toContain(color.family);
      expect(color.hex).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it('Monk tones cover 1–10 in order', () => {
    expect(MONK_TONES.map((t) => t.tone)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('monkRangeSchema accepts narrow ascending ranges only', () => {
    for (const ok of ['1-1', '4-5', '4-6', '8-10', '10-10']) expect(monkRangeSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['0-1', '5-4', '1-4', '10-11', '4–5', '4', 'a-b', ' 4-5']) {
      expect(monkRangeSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('enum schemas accept listed IDs and reject others', () => {
    expect(departmentSchema.parse('any')).toBe('any');
    expect(occasionSchema.safeParse('festive').success).toBe(true);
    expect(occasionSchema.safeParse('Festive').success).toBe(false);
    expect(categorySchema.safeParse('kurta').success).toBe(true);
    expect(categorySchema.safeParse('hoodie').success).toBe(false);
    expect(colorIdSchema.safeParse('navy').success).toBe(true);
    expect(colorIdSchema.safeParse('#1F2A44').success).toBe(false);
  });
});
