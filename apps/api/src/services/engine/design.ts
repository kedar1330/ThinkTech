import {
  CATEGORY_IDS,
  DESIGN_MATCH_ATTRIBUTES,
  FIT_IDS,
  GARMENT_LENGTH_IDS,
  NECKLINE_IDS,
  SILHOUETTE_IDS,
  SLEEVE_LENGTH_IDS,
  type Category,
  type DesignMatch,
  type DesignMatchAttribute,
  type LookSpec,
} from '@styleme/contracts';

// Looks built around a designed garment (D-132). Pure, like the rest of the engine. A design is a ranking
// preference, never a filter: looks with the garment and every chosen feature come first, then the garment
// with the fewest differences, then the rest, so a request always returns looks.
//
// Design features map to the look vocabulary by exact ID only (`neckline_v_neck` → `v_neck`). Features with
// no exact equivalent (`sleeve_full_length`, pleats, pockets …) don't count until a founder-approved mapping
// table exists (D-62); they still show on the user's design.

export interface EngineDesign {
  category: Category;
  features: Partial<Record<DesignMatchAttribute, string>>;
}

const VOCABULARY: Record<DesignMatchAttribute, readonly string[]> = {
  neckline: NECKLINE_IDS,
  sleeve: SLEEVE_LENGTH_IDS,
  fit: FIT_IDS,
  silhouette: SILHOUETTE_IDS,
  length: GARMENT_LENGTH_IDS,
};

/** The engine's view of a saved design selection, or null when its garment isn't a look category. */
export function toEngineDesign(garmentType: string, selected: Record<string, unknown>): EngineDesign | null {
  let mappedCategory = garmentType;
  if (!(CATEGORY_IDS as readonly string[]).includes(mappedCategory)) {
    // Map known garments from Outfit Categories that are variants of core look categories
    if (garmentType === 'anarkali') mappedCategory = 'kurti';
    else if (garmentType === 'saree_blouse') mappedCategory = 'kurti';
    else if (garmentType === 'palazzo') mappedCategory = 'trousers';
    else if (garmentType === 'blouse' || garmentType === 'tunic') mappedCategory = 'shirt';
    else return null;
  }
  const features: EngineDesign['features'] = {};
  for (const attribute of DESIGN_MATCH_ATTRIBUTES) {
    const featureId = selected[attribute];
    if (typeof featureId !== 'string' || !featureId.startsWith(`${attribute}_`)) continue;
    const value = featureId.slice(attribute.length + 1);
    if (VOCABULARY[attribute].includes(value)) features[attribute] = value;
  }
  if (garmentType === 'anarkali' && !features.silhouette) {
    features.silhouette = 'a_line';
  }
  return { category: mappedCategory as Category, features };
}

export const COMPATIBLE_CATEGORIES: Record<string, readonly Category[]> = {
  kurti: ['kurti', 'kurta'],
  kurta: ['kurta', 'kurti'],
  shirt: ['shirt', 't_shirt'],
  t_shirt: ['t_shirt', 'shirt'],
  trousers: ['trousers'],
};

/** How a look's garments compare with the design. */
export function matchDesign(specs: readonly LookSpec[], design: EngineDesign): DesignMatch {
  const compatible = COMPATIBLE_CATEGORIES[design.category] ?? [design.category];
  const spec = specs.find((s) => s.category === design.category || compatible.includes(s.category));
  if (!spec) return { level: 'none', differs: [] };
  const differs = DESIGN_MATCH_ATTRIBUTES.filter(
    (a) => design.features[a] !== undefined && spec[a] !== design.features[a],
  );
  return { level: differs.length === 0 ? 'full' : 'partial', differs };
}

/** Sort key: full first, then partial by fewest differences, then none. */
export function designRank(match: DesignMatch): number {
  return match.level === 'full' ? 0 : match.level === 'partial' ? match.differs.length : 100;
}
