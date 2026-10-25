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
  // Stores use kurta and kurti for the same garment.
  'category:kurta': ['kurti'],
  'category:kurti': ['kurta'],
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

/**
 * Whether a normalised title contains a term as whole words (a plural "s" allowed). Words joined by hyphens
 * ("Kurta-Cotton-Peach") count as separate words too.
 */
function hasTerm(title: string, term: string): boolean {
  const t = normalise(term).trim();
  const has = (text: string) => text.includes(` ${t} `) || text.includes(` ${t}s `);
  return has(title) || (title.includes('-') && has(title.replace(/-/g, ' ')));
}

/** The words that mean this value in a listing title. */
export function termsFor(attribute: LookSpecAttribute, value: string): string[] {
  const label = VOCABULARY[attribute].find((v) => v.id === value)?.label.toLowerCase();
  const synonyms = SYNONYMS[`${attribute}:${value}`] ?? [];
  const useLabel = label && (!SYNONYMS_ONLY[attribute] || synonyms.length === 0);
  return [...new Set([...synonyms, ...(useLabel ? [label] : [])])];
}

/**
 * The garment's attributes whose words appear in the listing title, in `lookSpec` order. A fabric written as
 * a blend ("cotton blend") is not that fabric.
 */
export function matchedAttributes(title: string, spec: LookSpec): LookSpecAttribute[] {
  const text = normalise(title);
  return valuesOf(spec)
    .filter(([attribute, value]) =>
      termsFor(attribute, value).some(
        (term) => hasTerm(text, term) && !(attribute === 'fabric' && hasTerm(text, `${term} blend`)),
      ),
    )
    .map(([attribute]) => attribute);
}

// Relevance (Shop My Look accuracy): what makes a listing a poor fit whatever it matches. Only words in the
// store's own title count, like the matches above.

/** Why a listing is a poor fit: another department, children's wear, a set, or another colour. */
export type ListingConflict = 'department' | 'kids' | 'set' | 'color';

const hasAny = (text: string, terms: readonly string[]) => terms.some((term) => hasTerm(text, term));

const WOMEN_TERMS = ['women', 'woman', 'ladies', 'lady', 'female'];
const MEN_TERMS = ['men', 'man', 'gents', 'boy', 'male'];
/** Garments and pieces only one department wears, so a title naming one says whose it is. */
const WOMEN_ONLY_TERMS = ['kurti', 'dupatta', 'anarkali', 'palazzo', 'saree', 'sari', 'lehenga', 'gown', 'legging'];
const MEN_ONLY_TERMS = ['pathani', 'sherwani', 'bandhgala', 'nehru jacket', 'nehru'];
const KIDS_TERMS = ['kids', 'kid', 'baby', 'infant', 'toddler', 'child', 'children'];
const SET_TERMS = [
  'set',
  'combo',
  'pack of',
  'with dupatta',
  'and dupatta',
  'dupatta set',
  'with trouser',
  'with pant',
  'with palazzo',
  'with bottom',
  'with skirt',
];

/** Plain colour words stores use besides the vocabulary's shades, by colour family. */
const FAMILY_WORDS: Record<string, string[]> = {
  red: ['red'],
  pink: ['pink'],
  orange: ['orange'],
  yellow: ['yellow'],
  green: ['green'],
  blue: ['blue'],
  purple: ['purple', 'violet'],
  brown: ['brown'],
};

/** Colour words of other families than `family`. Metallics are left out: "gold" is usually zari or work. */
function otherColourWords(family: string): string[] {
  const shades = COLORS.filter((c) => c.family !== family && c.family !== 'metallic').map((c) => c.label);
  const plain = Object.entries(FAMILY_WORDS).flatMap(([f, words]) => (f === family ? [] : words));
  return [...shades, ...plain].map((w) => w.toLowerCase());
}

/** The reasons a listing doesn't fit the garment and the look's department (`women`, `men` or `any`). */
export function conflictsOf(title: string, spec: LookSpec, department: string | null | undefined): ListingConflict[] {
  const text = normalise(title);
  const conflicts: ListingConflict[] = [];
  const women = hasAny(text, WOMEN_TERMS);
  const men = hasAny(text, MEN_TERMS);
  if (
    (department === 'women' &&
      (men || hasAny(text, MEN_ONLY_TERMS)) &&
      !women &&
      !hasAny(text, ['girl', 'unisex', ...WOMEN_ONLY_TERMS])) ||
    (department === 'men' &&
      (women || hasAny(text, ['girl', ...WOMEN_ONLY_TERMS])) &&
      !men &&
      !hasAny(text, ['unisex', ...MEN_ONLY_TERMS]))
  ) {
    conflicts.push('department');
  }
  // "Women's and girls' kurti" is for adults too; "girls kurti" alone is children's wear.
  if (hasAny(text, KIDS_TERMS) || (hasAny(text, ['girl', 'boy']) && !women && !hasAny(text, ['men', 'man']))) {
    conflicts.push('kids');
  }
  const slotType = CATEGORIES.find((c) => c.id === spec.category)?.slotType;
  if (slotType !== 'one_piece' && hasAny(text, SET_TERMS)) conflicts.push('set');
  // Another colour counts only when the title names a colour of another family, and neither the garment's own
  // colour nor its family.
  const own = [...termsFor('color', spec.colorId), ...(FAMILY_WORDS[spec.colorFamily] ?? [])];
  if (!hasAny(text, own) && hasAny(text, otherColourWords(spec.colorFamily))) conflicts.push('color');
  return conflicts;
}

/**
 * Whether the listing's own title shows it's for the look's department: it says so ("women", "men's"), or names
 * a garment only that department wears ("kurti"). A title that doesn't, like "Kurta-Cotton-Peach", is as likely
 * the other department's, even on a kurti look (kurta and kurti match each other).
 */
export function departmentConfirmed(title: string, department: string | null | undefined): boolean {
  if (department !== 'women' && department !== 'men') return true;
  const text = normalise(title);
  return department === 'women'
    ? hasAny(text, [...WOMEN_TERMS, 'girl', ...WOMEN_ONLY_TERMS])
    : hasAny(text, [...MEN_TERMS, ...MEN_ONLY_TERMS]);
}

export interface ListingRelevance {
  matched: LookSpecAttribute[];
  conflicts: ListingConflict[];
  /** Whether the listing is this garment at all: it names the garment, for the right department, not a child's. */
  relevant: boolean;
  /** Whether the title says it's for the look's department; unconfirmed items rank after every confirmed one. */
  confirmed: boolean;
  /** Matched attributes less the softer conflicts (a set, another colour); higher is better. */
  score: number;
}

/** Best fit first: confirmed for the department, then the higher score, then the lower price. */
export function byRelevance(
  a: { confirmed: boolean; score: number; price: number },
  b: { confirmed: boolean; score: number; price: number },
): number {
  return Number(b.confirmed) - Number(a.confirmed) || b.score - a.score || a.price - b.price;
}

/** How well a store listing fits one garment of a look. */
export function relevanceOf(title: string, spec: LookSpec, department: string | null | undefined): ListingRelevance {
  const matched = matchedAttributes(title, spec);
  const conflicts = conflictsOf(title, spec, department);
  const confirmed = departmentConfirmed(title, department);
  const slotType = CATEGORIES.find((c) => c.id === spec.category)?.slotType;
  // A set can't be bought as just the trousers or skirt, so it isn't that garment.
  const setForBottom = slotType === 'bottom' && conflicts.includes('set');
  const relevant =
    matched.includes('category') && !conflicts.includes('department') && !conflicts.includes('kids') && !setForBottom;
  const soft = conflicts.filter((c) => c === 'set' || c === 'color').length;
  return { matched, conflicts, relevant, confirmed, score: matched.length - soft };
}

/** The broad query for other styles of the same garment: its category and the department, nothing else. */
export function categoryQuery(spec: LookSpec, department: string | null | undefined): string {
  const category = CATEGORIES.find((c) => c.id === spec.category)?.label ?? spec.category;
  return [category, department].filter(Boolean).join(' ').toLowerCase();
}
