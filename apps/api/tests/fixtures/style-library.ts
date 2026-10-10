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
