import {
  CATEGORIES,
  COLORS,
  CONTRAST_LEVEL_IDS,
  FABRIC_IDS,
  OCCASION_IDS,
  SILHOUETTE_IDS,
  STYLE_IDS,
  UNDERTONE_AFFINITY_IDS,
  type Department,
} from '@styleme/contracts';
import { COORDINATION_ASPECTS, RULE_AREAS, type RawLibrary } from '../../src/style-rules';

// Synthetic style-knowledge-base fixtures (CONTRIBUTING.md §5). Every record is `isFixture: true`;
// none of this is styling content, it is never reviewed by the founder and never deployed. Used by
// the linter/loader unit tests and the scale test T-38.

const REVIEW = { reviewStatus: 'approved', reviewedBy: 'fixture', reviewedAt: '2026-01-01', isFixture: true } as const;
const TEXT = {
  rationale: 'Synthetic fixture rationale describing an effect.',
  limitations: 'Synthetic fixture; not styling advice.',
};

const id = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, '0')}`;
const pick = <T>(list: readonly T[], n: number): T => list[n % list.length]!;

type Overrides = Record<string, unknown>;

export function fixturePalette(n: number, overrides: Overrides = {}) {
  const neutrals = COLORS.filter((c) => c.family === 'neutral').map((c) => c.id);
  const accents = COLORS.filter((c) => c.family !== 'neutral').map((c) => c.id);
  const neutral = pick(neutrals, n);
  const accent = pick(accents, n);
  return {
    id: id('PAL', n),
    version: 1,
    tags: ['fixture'],
    ...TEXT,
    ...REVIEW,
    name: `Fixture palette ${n}`,
    undertoneAffinity: [pick(UNDERTONE_AFFINITY_IDS, n)],
    neutrals: [neutral],
    accents: [accent],
    combinations: [{ colors: [neutral, accent], contrastLevel: pick(CONTRAST_LEVEL_IDS, n) }],
    occasions: [pick(OCCASION_IDS, n), pick(OCCASION_IDS, n + 3)],
    ...overrides,
  };
}

export function fixtureStylingRule(n: number, overrides: Overrides = {}) {
  const area = pick(RULE_AREAS, n);
  const category = pick(CATEGORIES, n);
  return {
    id: id('STY', n),
    version: 1,
    tags: ['fixture'],
    ...TEXT,
    ...REVIEW,
    type: 'silhouette',
    areas: [area],
    coordinationAspects: area === 'coordination' ? [pick(COORDINATION_ASPECTS, n)] : [],
    appliesTo: { categories: [category.id], occasions: [pick(OCCASION_IDS, n)] },
    // Prefer-only, so generated fixture rules never contradict each other.
    effect: { prefer: [{ attribute: 'silhouette', value: pick(SILHOUETTE_IDS, n) }], weight: 0.5 },
    ...overrides,
  };
}

export function fixtureFabricRule(n: number, overrides: Overrides = {}) {
  return {
    id: id('FAB', n),
    version: 1,
    tags: ['fixture'],
    ...TEXT,
    ...REVIEW,
    fabric: pick(FABRIC_IDS, n),
    properties: {
      breathability: 'high',
      moistureManagement: 'medium',
      quickDry: false,
      warmth: 'low',
      weight: 'light',
      stretch: 'none',
      wrinkleResistance: 'low',
      care: 'easy',
    },
    useCases: [`fixture use case ${n}`],
    areas: ['preference'],
    appliesTo: { occasions: [pick(OCCASION_IDS, n)] },
    effect: { prefer: [{ attribute: 'fabric', value: pick(FABRIC_IDS, n) }], weight: 0.4 },
    practicalityValidated: true,
    ...overrides,
  };
}

const SLOTS_BY_DEPARTMENT: Record<Department, { slotId: string; slot: string; categoryOptions: string[] }[]> = {
  women: [
    { slotId: 'top', slot: 'top', categoryOptions: ['kurti', 'shirt', 't_shirt'] },
    { slotId: 'bottom', slot: 'bottom', categoryOptions: ['trousers', 'jeans'] },
    { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'] },
    { slotId: 'accessory-1', slot: 'accessory', categoryOptions: ['accessory'] },
  ],
  men: [
    { slotId: 'top', slot: 'top', categoryOptions: ['kurta', 'shirt'] },
    { slotId: 'bottom', slot: 'bottom', categoryOptions: ['trousers', 'jeans'] },
    { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'] },
  ],
  any: [
    { slotId: 'top', slot: 'top', categoryOptions: ['t_shirt', 'shirt'] },
    { slotId: 'bottom', slot: 'bottom', categoryOptions: ['jeans'] },
    { slotId: 'footwear', slot: 'footwear', categoryOptions: ['shoes'] },
    { slotId: 'accessory-1', slot: 'accessory', categoryOptions: ['accessory'] },
    { slotId: 'accessory-2', slot: 'accessory', categoryOptions: ['accessory'] },
  ],
};

export function fixtureTemplate(n: number, overrides: Overrides & { paletteCount?: number; ruleCount?: number } = {}) {
  const { paletteCount = 0, ruleCount = 0, ...rest } = overrides;
  const department = pick(['women', 'men', 'any'] as const, n);
  return {
    id: id('OUT', n),
    version: 1,
    tags: ['fixture'],
    ...TEXT,
    ...REVIEW,
    name: `Fixture template ${n}`,
    department,
    occasions: [pick(OCCASION_IDS, n), pick(OCCASION_IDS, n + 1)],
    styles: [pick(STYLE_IDS, Math.floor(n / OCCASION_IDS.length))],
    slots: SLOTS_BY_DEPARTMENT[department],
    compatiblePalettes: paletteCount > 0 ? [id('PAL', (n % paletteCount) + 1)] : [],
    ruleRefs: ruleCount > 0 ? [id('STY', (n % ruleCount) + 1)] : [],
    ...rest,
  };
}

/**
 * A small hand-built library for the look engine and palette tests (#33, #34): every department, wear
 * type, slot role and rule tier appears at least once, so each engine step can be tested by name.
 * Synthetic like everything here — the colours, rules and wording are not styling advice.
 */
export function buildEngineFixtureLibrary(): RawLibrary {
  const slot = (slotId: string, slot: string, categoryOptions: string[], extra: Overrides = {}) => ({
    slotId,
    slot,
    categoryOptions,
    ...extra,
  });
  const footwear = slot('footwear', 'footwear', ['shoes'], { colorRole: 'neutral' });
  return {
    palettes: [
      fixturePalette(1, {
        name: 'Fixture warm',
        undertoneAffinity: ['warm'],
        neutrals: ['cream', 'tan'],
        accents: ['rust', 'mustard'],
        combinations: [
          { colors: ['cream', 'rust'], contrastLevel: 'medium' },
          { colors: ['tan', 'mustard'], contrastLevel: 'low' },
        ],
        occasions: ['everyday', 'work'],
      }),
      fixturePalette(2, {
        name: 'Fixture cool',
        undertoneAffinity: ['cool'],
        skinToneRange: '2-4',
        neutrals: ['white', 'navy', 'grey'],
        accents: ['powder_blue', 'lavender'],
        combinations: [
          { colors: ['navy', 'white'], contrastLevel: 'high' },
          { colors: ['grey', 'powder_blue'], contrastLevel: 'low' },
          { colors: ['white', 'lavender'], contrastLevel: 'medium' },
        ],
        occasions: ['everyday', 'work', 'formal'],
      }),
      fixturePalette(3, {
        name: 'Fixture festive',
        undertoneAffinity: ['any'],
        neutrals: ['ivory', 'gold'],
        accents: ['maroon', 'emerald'],
        combinations: [
          { colors: ['ivory', 'maroon'], contrastLevel: 'high' },
          { colors: ['gold', 'emerald'], contrastLevel: 'medium' },
        ],
        occasions: ['festive', 'wedding'],
      }),
    ],
    stylingRules: [
      fixtureStylingRule(1, {
        rationale: 'Synthetic fixture rationale: one solid piece makes the look easier to coordinate.',
        type: 'coordination',
        areas: ['coordination'],
        coordinationAspects: ['pattern_mixing'],
        appliesTo: { occasions: ['everyday'] },
        effect: { prefer: [{ attribute: 'pattern', value: 'solid' }], weight: 0.3 },
      }),
      fixtureStylingRule(2, {
        rationale: 'Synthetic fixture rationale: straight trousers keep a clean line under a long top.',
        areas: ['coordination'],
        coordinationAspects: ['proportion_balance'],
        appliesTo: { categories: ['trousers'], styles: ['traditional'] },
        effect: { prefer: [{ attribute: 'silhouette', value: 'straight' }], weight: 0.4 },
      }),
      // Scoped to self-described proportions, so it counts as an appearance signal (lowest tier).
      fixtureStylingRule(3, {
        rationale: 'Synthetic fixture rationale: tapered trousers narrow towards the ankle.',
        type: 'proportion',
        areas: ['fit'],
        appliesTo: { categories: ['trousers'], proportions: ['hips_wider_than_shoulders'] },
        effect: { prefer: [{ attribute: 'silhouette', value: 'tapered' }], weight: 1 },
      }),
      fixtureStylingRule(4, {
        rationale: 'Synthetic fixture rationale: an A-line kurti flares gently from the chest.',
        type: 'proportion',
        areas: ['fit'],
        appliesTo: { categories: ['kurti'], proportions: ['hips_wider_than_shoulders'] },
        effect: { prefer: [{ attribute: 'silhouette', value: 'a_line' }], weight: 0.5 },
      }),
    ],
    fabricRules: [
      fixtureFabricRule(1, {
        fabric: 'cotton',
        rationale: 'Synthetic fixture rationale: cotton is a breathable everyday fabric.',
        appliesTo: { occasions: ['everyday', 'work'] },
        effect: { prefer: [{ attribute: 'fabric', value: 'cotton' }], weight: 0.4 },
      }),
      fixtureFabricRule(2, {
        fabric: 'silk',
        rationale: 'Synthetic fixture rationale: silk has a sheen often chosen for festive wear.',
        appliesTo: { occasions: ['festive', 'wedding'] },
        effect: { prefer: [{ attribute: 'fabric', value: 'silk' }], weight: 0.5 },
      }),
    ],
    templates: [
      fixtureTemplate(1, {
        name: 'Fixture kurti set',
        tags: ['fixture', 'wear-indian'],
        department: 'women',
        occasions: ['everyday', 'work'],
        styles: ['casual', 'traditional'],
        slots: [
          slot('top', 'top', ['kurti'], { colorRole: 'accent' }),
          slot('bottom', 'bottom', ['trousers'], {
            colorRole: 'neutral',
            constraints: { silhouettes: ['straight', 'tapered', 'wide_leg'] },
          }),
          footwear,
          slot('accessory-1', 'accessory', ['accessory'], { optional: true }),
        ],
        compatiblePalettes: ['PAL-001', 'PAL-002'],
        ruleRefs: ['STY-002', 'FAB-001'],
      }),
      fixtureTemplate(2, {
        name: 'Fixture shirt and trousers',
        tags: ['fixture', 'wear-western'],
        department: 'any',
        occasions: ['everyday', 'work', 'formal'],
        styles: ['classic', 'smart_casual'],
        slots: [
          slot('top', 'top', ['shirt'], { constraints: { necklines: ['collared'] } }),
          slot('bottom', 'bottom', ['trousers', 'jeans'], { colorRole: 'neutral' }),
          footwear,
        ],
        compatiblePalettes: [],
      }),
      fixtureTemplate(3, {
        name: 'Fixture kurta set',
        tags: ['fixture', 'wear-indian'],
        department: 'men',
        occasions: ['everyday'],
        styles: ['casual', 'traditional'],
        slots: [
          slot('top', 'top', ['kurta'], { colorRole: 'accent' }),
          slot('bottom', 'bottom', ['trousers'], { colorRole: 'neutral' }),
          footwear,
        ],
        compatiblePalettes: ['PAL-001'],
      }),
      fixtureTemplate(4, {
        name: 'Fixture festive drape',
        tags: ['fixture', 'wear-indian'],
        department: 'women',
        occasions: ['festive', 'wedding'],
        styles: ['traditional'],
        slots: [
          slot('outfit', 'one_piece', ['saree', 'lehenga'], { colorRole: 'accent' }),
          footwear,
          slot('accessory-1', 'accessory', ['accessory'], { colorRole: 'neutral' }),
        ],
        compatiblePalettes: ['PAL-003'],
      }),
      fixtureTemplate(5, {
        name: 'Fixture tee and jeans',
        tags: ['fixture', 'wear-fusion'],
        department: 'any',
        occasions: ['everyday'],
        styles: ['casual', 'streetwear'],
        slots: [
          slot('top', 'top', ['t_shirt'], { constraints: { sleeves: ['short', 'elbow'] } }),
          slot('bottom', 'bottom', ['jeans'], { colorRole: 'neutral' }),
          footwear,
        ],
        compatiblePalettes: ['PAL-002'],
      }),
    ],
  };
}

const range = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

/** A synthetic library of the given size; defaults to the T-38 scale (150 palettes, 150 templates). */
export function buildFixtureLibrary({
  palettes = 150,
  templates = 150,
  stylingRules = 60,
  fabricRules = 17,
} = {}): RawLibrary {
  return {
    palettes: range(palettes).map((n) => fixturePalette(n)),
    stylingRules: range(stylingRules).map((n) => fixtureStylingRule(n)),
    fabricRules: range(fabricRules).map((n) => fixtureFabricRule(n)),
    templates: range(templates).map((n) => fixtureTemplate(n, { paletteCount: palettes, ruleCount: stylingRules })),
  };
}
