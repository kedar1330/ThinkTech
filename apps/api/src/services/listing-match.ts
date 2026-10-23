import {
  CATEGORIES,
  COLORS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  NECKLINES,
  PATTERNS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  type LookSpec,
  type LookSpecAttribute,
} from '@styleme/contracts';

// Which of a garment's attributes a store listing's title mentions (#133), so Shop My Look can show the
// items that match the look first. Only words actually in the store's own title count: a match is never
// assumed. Each attribute matches its vocabulary label, or one of the common ways stores write it.

type Vocabulary = readonly { id: string; label: string }[];

/** Other ways listings write a value (`attribute:value`); the label itself counts too, except where noted. */
const SYNONYMS: Record<string, string[]> = {
  'category:t_shirt': ['t-shirt', 'tshirt', 't shirt', 'tee'],
  'category:trousers': ['trouser', 'pants', 'pant'],
  'neckline:v_neck': ['v-neck', 'v neck'],
  'neckline:collared': ['collar'],
  'neckline:mandarin': ['mandarin', 'chinese collar', 'band collar'],
  'neckline:round': ['round neck', 'crew neck'],
  'neckline:boat': ['boat neck'],
  'neckline:square': ['square neck'],
  'neckline:sweetheart': ['sweetheart'],
  'neckline:high_neck': ['high neck', 'turtle neck', 'turtleneck'],
  'sleeve:sleeveless': ['sleeveless'],
  'sleeve:cap': ['cap sleeve'],
  'sleeve:short': ['short sleeve', 'half sleeve'],
  'sleeve:elbow': ['elbow sleeve', 'elbow length'],
  'sleeve:three_quarter': ['three-quarter', 'three quarter', '3/4'],
  'sleeve:full': ['full sleeve', 'long sleeve'],
  'pattern:solid': ['plain'],
  'pattern:stripes': ['stripe', 'striped'],
  'pattern:checks': ['check', 'checked', 'checkered'],
  'pattern:polka_dots': ['polka'],
  'fit:relaxed': ['loose'],
};

/**
 * Neckline and sleeve labels are bare ("Round", "Short"), which would match unrelated words, so for those
 * only the synonyms above count.
 */
const SYNONYMS_ONLY: Partial<Record<LookSpecAttribute, true>> = { neckline: true, sleeve: true };

const VOCABULARY: Record<LookSpecAttribute, Vocabulary> = {
  category: CATEGORIES,
  color: COLORS,
  fabric: FABRICS,
  fit: FITS,
  silhouette: SILHOUETTES,
  neckline: NECKLINES,
  sleeve: SLEEVE_LENGTHS,
  length: GARMENT_LENGTHS,
  pattern: PATTERNS,
};

/** The value of each matchable attribute in a garment's spec (colour by its colour, not its family). */
function valuesOf(spec: LookSpec): Array<[LookSpecAttribute, string]> {
  const values: Array<[LookSpecAttribute, string | undefined]> = [
    ['category', spec.category],
    ['color', spec.colorId],
    ['fabric', spec.fabric],
    ['fit', spec.fit],
    ['silhouette', spec.silhouette],
    ['neckline', spec.neckline],
    ['sleeve', spec.sleeve],
    ['length', spec.length],
    ['pattern', spec.pattern],
  ];
  return values.filter((v): v is [LookSpecAttribute, string] => Boolean(v[1]));
}

const normalise = (text: string) =>
  ` ${text
    .toLowerCase()
    .replace(/[‐-―]/g, '-')
    .replace(/[^a-z0-9/\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

/** Whether a normalised title contains a term as whole words (a plural "s" allowed). */
function hasTerm(title: string, term: string): boolean {
  const t = normalise(term).trim();
  return title.includes(` ${t} `) || title.includes(` ${t}s `);
}

/** The words that mean this value in a listing title. */
export function termsFor(attribute: LookSpecAttribute, value: string): string[] {
  const label = VOCABULARY[attribute].find((v) => v.id === value)?.label.toLowerCase();
  const synonyms = SYNONYMS[`${attribute}:${value}`] ?? [];
  const useLabel = label && (!SYNONYMS_ONLY[attribute] || synonyms.length === 0);
  return [...new Set([...synonyms, ...(useLabel ? [label] : [])])];
}

/** The garment's attributes whose words appear in the listing title, in `lookSpec` order. */
export function matchedAttributes(title: string, spec: LookSpec): LookSpecAttribute[] {
  const text = normalise(title);
  return valuesOf(spec)
    .filter(([attribute, value]) => termsFor(attribute, value).some((term) => hasTerm(text, term)))
    .map(([attribute]) => attribute);
}

/** The broad query for other styles of the same garment: its category and the department, nothing else. */
export function categoryQuery(spec: LookSpec, department: string | null | undefined): string {
  const category = CATEGORIES.find((c) => c.id === spec.category)?.label ?? spec.category;
  return [category, department].filter(Boolean).join(' ').toLowerCase();
}
