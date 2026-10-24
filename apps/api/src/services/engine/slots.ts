import {
  CATEGORIES,
  COLORS,
  FABRIC_IDS,
  FIT_GROUPS,
  FIT_IDS,
  GARMENT_LENGTH_IDS,
  NECKLINE_IDS,
  PATTERN_IDS,
  SILHOUETTE_IDS,
  SLEEVE_LENGTH_IDS,
  type Category,
  type CategoryGroup,
  type ColorId,
  type Department,
  type LookSpec,
  type PaletteMode,
  type SlotType,
} from '@styleme/contracts';
import type { Palette, TemplateSlot } from '../../style-rules/schemas';
import type { Preferences } from './preferences';
import { ruleEffects, type ApplicableRule, type AttributeValues } from './rules';
import { COORDINATION, ZERO, add, compareScores, isSupported, round, type Score } from './score';
import { categoryGroup } from './text';

// fillSlots: one look specification per template slot, plus its alternatives (FR-LOOK-04, -14).
// Hard constraints filter the options (department, disliked colours, avoided fabrics, coverage);
// preferences, rules and signals then rank what is left (score.ts).

/** The hard constraint that removed every option, used for `limitedBy` (FR-LOOK-11). */
export type Constraint = 'department' | 'dislikedColors' | 'avoidedFabrics' | 'coverage';

export interface Match {
  attribute: string;
  value: string;
}

/** A scored part of a choice: why it ranks where it does. */
interface Scored {
  score: Score;
  /** Rule ID → contribution, for rules that supported the choice. */
  supporting: Map<string, number>;
  /** Preferences and signals the choice matched. */
  matched: Match[];
}

export interface Choice extends Scored {
  spec: LookSpec;
}

export interface FilledSlot {
  slot: TemplateSlot;
  choice: Choice;
  alternatives: Choice[];
}

export interface SlotContext {
  prefs: Preferences;
  mode: PaletteMode;
  palette: Palette;
  /** Colours of the palette combination this look is built around, if any. */
  combination: readonly ColorId[] | null;
  rulesFor(category: Category): ApplicableRule[];
  /** Colours already used on earlier slots of this look, and on its garment slots. */
  usedColours: ReadonlySet<ColorId>;
  usedGarmentColours: ReadonlySet<ColorId>;
}

export const MAX_ALTERNATIVES = 5;
export const MIN_ALTERNATIVES = 3;

type Dimension = 'fabric' | 'silhouette' | 'fit' | 'neckline' | 'sleeve' | 'length' | 'pattern';
const DIMENSIONS: readonly Dimension[] = ['fabric', 'silhouette', 'fit', 'neckline', 'sleeve', 'length', 'pattern'];
const CONSTRAINT_KEY = {
  fabric: 'fabrics',
  silhouette: 'silhouettes',
  fit: 'fits',
  neckline: 'necklines',
  sleeve: 'sleeves',
  length: 'lengths',
  pattern: 'patterns',
} as const satisfies Record<Dimension, keyof TemplateSlot['constraints']>;
const VOCABULARY: Record<Dimension, readonly string[]> = {
  fabric: FABRIC_IDS,
  silhouette: SILHOUETTE_IDS,
  fit: FIT_IDS,
  neckline: NECKLINE_IDS,
  sleeve: SLEEVE_LENGTH_IDS,
  length: GARMENT_LENGTH_IDS,
  pattern: PATTERN_IDS,
};
/** Alternatives vary these dimensions besides colour and category (FR-LOOK-14). */
const VARIED_DIMENSIONS: readonly Dimension[] = ['fabric', 'silhouette'];

const GARMENT_SLOTS = new Set<SlotType>(['top', 'bottom', 'one_piece', 'layer']);
/** Groups with sleeves, necklines and a garment length. */
const UPPER_GROUPS = new Set<CategoryGroup>(['tops', 'ethnicTops', 'dresses']);

/** Whether a slot's look specification states this dimension at all for the category. */
function dimensionApplies(dimension: Dimension, slot: TemplateSlot, group: CategoryGroup): boolean {
  if (slot.constraints[CONSTRAINT_KEY[dimension]]) return true;
  switch (dimension) {
    case 'fabric':
    case 'pattern':
      return GARMENT_SLOTS.has(slot.slot);
    case 'silhouette':
      return GARMENT_SLOTS.has(slot.slot) && group !== 'freeSize';
    case 'fit':
      return (FIT_GROUPS as readonly string[]).includes(group);
    default:
      return UPPER_GROUPS.has(group);
  }
}

/** Categories offered to the user's department in Stage 1 (department `any` sees all). */
export function offered(category: Category, department: Department): boolean {
  const entry = CATEGORIES.find((c) => c.id === category)!;
  return entry.stage === 1 && (department === 'any' || (entry.departments as readonly string[]).includes(department));
}

/** Colours the slot may use: the palette's colours for its role; explore widens to the vocabulary (FR-LOOK-07). */
export function colourPool(role: TemplateSlot['colorRole'], palette: Palette, mode: PaletteMode, prefs: Preferences) {
  const own =
    role === 'neutral'
      ? palette.neutrals
      : role === 'accent'
        ? palette.accents.length > 0
          ? palette.accents
          : palette.neutrals
        : [...palette.neutrals, ...palette.accents];
  const wider =
    mode === 'explore'
      ? COLORS.filter((c) =>
          role === 'neutral' ? c.family === 'neutral' : role === 'accent' ? c.family !== 'neutral' : true,
        ).map((c) => c.id)
      : [];
  return [...new Set<ColorId>([...own, ...wider])].filter((color) => !prefs.disliked.has(color));
}

function scored(score: Score, supporting = new Map<string, number>(), matched: Match[] = []): Scored {
  return { score, supporting, matched };
}

function fromRules(
  rules: readonly ApplicableRule[],
  values: AttributeValues,
  extra: Score = ZERO,
  matched: Match[] = [],
) {
  const effect = ruleEffects(rules, values);
  return scored(add(effect.score, extra), effect.supporting, matched);
}

function compose(spec: LookSpec, parts: readonly Scored[]): Choice {
  const supporting = new Map<string, number>();
  for (const part of parts) for (const [id, w] of part.supporting) supporting.set(id, (supporting.get(id) ?? 0) + w);
  return {
    spec,
    score: round(add(...parts.map((p) => p.score))),
    supporting,
    matched: parts.flatMap((p) => p.matched),
  };
}

/** First of the highest-scoring entries; earlier entries win ties, so results are stable. */
function best<T extends { score: Score }>(entries: readonly T[]): T | undefined {
  let top: T | undefined;
  for (const entry of entries) if (!top || compareScores(entry.score, top.score) < 0) top = entry;
  return top;
}

interface DimensionChoice extends Scored {
  value: string;
}

interface CategoryPlan {
  category: Category;
  base: Scored;
  dims: Map<Dimension, DimensionChoice>;
  /** Other values a varied dimension could take: constrained by the template or supported by something. */
  variants: Map<Dimension, DimensionChoice[]>;
  colours: (Scored & { color: ColorId })[];
}

function scoreDimension(
  dimension: Dimension,
  value: string,
  group: CategoryGroup,
  rules: readonly ApplicableRule[],
  prefs: Preferences,
): DimensionChoice {
  const matched: Match[] = [];
  let preference = 0;
  if (dimension === 'fabric' && prefs.likedFabrics.has(value as never)) {
    preference = 1;
    matched.push({ attribute: 'likedFabric', value });
  } else if (dimension === 'silhouette' && prefs.silhouettes.has(value as never)) {
    preference = 1;
    matched.push({ attribute: 'preferredSilhouette', value });
  } else if (dimension === 'fit' && prefs.fit[group as keyof Preferences['fit']] === value) {
    preference = 1;
    matched.push({ attribute: 'preferredFit', value });
  }
  return { value, ...fromRules(rules, { [dimension]: value }, { ...ZERO, preference }, matched) };
}

function planCategory(
  category: Category,
  slot: TemplateSlot,
  pool: readonly ColorId[],
  ctx: SlotContext,
): CategoryPlan | Constraint {
  const { prefs } = ctx;
  const group = categoryGroup(category);
  const rules = ctx.rulesFor(category);
  const dims = new Map<Dimension, DimensionChoice>();
  const variants = new Map<Dimension, DimensionChoice[]>();

  for (const dimension of DIMENSIONS) {
    if (!dimensionApplies(dimension, slot, group)) continue;
    // There is no neckline-to-coverage mapping yet, so with a neckline minimum no neckline is claimed.
    if (dimension === 'neckline' && prefs.coverage.minNecklineCoverage) continue;
    const constrained = slot.constraints[CONSTRAINT_KEY[dimension]] as readonly string[] | undefined;
    let options = constrained ?? VOCABULARY[dimension];
    let coverageDriven = false;
    if (dimension === 'fabric') {
      options = options.filter((f) => !prefs.avoidedFabrics.has(f as never));
      if (options.length === 0) return 'avoidedFabrics';
    }
    const minimum =
      dimension === 'sleeve'
        ? prefs.coverage.minSleeveLength
        : dimension === 'length'
          ? prefs.coverage.minGarmentLength
          : null;
    if (minimum) {
      const order = VOCABULARY[dimension];
      options = options.filter((v) => order.indexOf(v) >= order.indexOf(minimum));
      if (options.length === 0) return 'coverage';
      coverageDriven = true;
    }
    const all = options.map((value) => scoreDimension(dimension, value, group, rules, prefs));
    const eligible = all.filter((c) => constrained || isSupported(c.score));
    const top = best(coverageDriven || constrained ? all : eligible);
    if (!top) continue;
    if (coverageDriven) top.matched.push({ attribute: 'coverage', value: dimension });
    dims.set(dimension, top);
    if (VARIED_DIMENSIONS.includes(dimension))
      variants.set(
        dimension,
        eligible.filter((c) => c !== top),
      );
  }

  const base = fromRules(rules, { category, slotType: slot.slot });
  const garment = GARMENT_SLOTS.has(slot.slot);
  // Garments are strictly chosen from the user's selected/palette colours when available
  const eligibleColours = garment && prefs.liked.size > 0 ? pool.filter((c) => prefs.liked.has(c)) : pool;
  const effectivePool = eligibleColours.length > 0 ? eligibleColours : pool;
  const colours = effectivePool.map((color) => {
    const family = COLORS.find((c) => c.id === color)!.family;
    // A liked colour counts once per look, so one liked colour doesn't take over every slot.
    const liked = prefs.liked.has(color) && !ctx.usedColours.has(color);
    let coordination = 0;
    if (ctx.combination?.includes(color)) coordination += COORDINATION.inCombination;
    if (ctx.mode === 'explore' && [...ctx.palette.neutrals, ...ctx.palette.accents].includes(color))
      coordination += COORDINATION.inPalette;
    if (garment && ctx.usedGarmentColours.has(color)) coordination += COORDINATION.repeatedColour;
    return {
      color,
      ...fromRules(
        rules,
        { color, colorFamily: family },
        { preference: liked ? 10 : 0, rule: coordination, signal: 0, feedback: 0 },
        liked ? [{ attribute: 'likedColor', value: color }] : [],
      ),
    };
  });
  return { category, base, dims, variants, colours };
}

function specFor(plan: CategoryPlan, color: ColorId, dims: Map<Dimension, DimensionChoice>): LookSpec {
  const spec: LookSpec = {
    category: plan.category,
    colorFamily: COLORS.find((c) => c.id === color)!.family,
    colorId: color,
  };
  for (const [dimension, choice] of dims) (spec as Record<string, string>)[dimension] = choice.value;
  return spec;
}

function choiceFor(plan: CategoryPlan, colour: CategoryPlan['colours'][number], dims = plan.dims): Choice {
  return compose(specFor(plan, colour.color, dims), [plan.base, colour, ...dims.values()]);
}

const specKey = (spec: LookSpec) => JSON.stringify(Object.entries(spec).sort(([a], [b]) => a.localeCompare(b)));

/**
 * Fills one slot: the best look specification and up to 5 alternatives that each differ in one of
 * colour, category option, fabric or silhouette, and satisfy the same hard constraints (FR-LOOK-14).
 */
export function fillSlot(slot: TemplateSlot, ctx: SlotContext): FilledSlot | Constraint {
  const categories = slot.categoryOptions.filter((c) => offered(c, ctx.prefs.department));
  if (categories.length === 0) return 'department';
  const pool = colourPool(slot.colorRole, ctx.palette, ctx.mode, ctx.prefs);
  if (pool.length === 0) return 'dislikedColors';

  const plans: CategoryPlan[] = [];
  let failure: Constraint | undefined;
  for (const category of categories) {
    const plan = planCategory(category, slot, pool, ctx);
    if (typeof plan === 'string') failure ??= plan;
    else plans.push(plan);
  }
  if (plans.length === 0) return failure!;

  const perCategory = plans.map((plan) => ({ plan, choice: choiceFor(plan, best(plan.colours)!) }));
  const chosen = best(perCategory.map((p) => ({ ...p, score: p.choice.score })))!;
  const { plan } = chosen;
  const topColour = chosen.choice.spec.colorId;

  const candidates: Choice[] = [
    ...plan.colours.filter((c) => c.color !== topColour).map((c) => choiceFor(plan, c)),
    ...perCategory.filter((p) => p.plan !== plan).map((p) => p.choice),
    ...VARIED_DIMENSIONS.flatMap((dimension) =>
      (plan.variants.get(dimension) ?? []).map((variant) =>
        choiceFor(
          plan,
          plan.colours.find((c) => c.color === topColour)!,
          new Map([...plan.dims, [dimension, variant]]),
        ),
      ),
    ),
  ];
  const seen = new Set([specKey(chosen.choice.spec)]);
  const alternatives: Choice[] = [];
  for (const candidate of candidates
    .map((choice, order) => ({ choice, order }))
    .sort((a, b) => compareScores(a.choice.score, b.choice.score) || a.order - b.order)) {
    const key = specKey(candidate.choice.spec);
    if (seen.has(key)) continue;
    seen.add(key);
    alternatives.push(candidate.choice);
    if (alternatives.length === MAX_ALTERNATIVES) break;
  }
  return { slot, choice: chosen.choice, alternatives };
}
