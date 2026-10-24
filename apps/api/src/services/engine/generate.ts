import { createHash } from 'node:crypto';
import {
  MAX_LOOKS,
  type ColorId,
  type DesignMatch,
  type LookSlot,
  type RecommendationRequest,
  type WarningCode,
} from '@styleme/contracts';
import type { Palette, Template } from '../../style-rules/schemas';
import { wearsContrast } from './contrast';
import { designRank, matchDesign, type EngineDesign } from './design';
import { explain, type Explanation } from './explain';
import { templateWearType, type StyleLibrary } from './library';
import {
  resolvePreferences,
  type EngineSignals,
  type PreferenceConflict,
  type Preferences,
  type ProfileWithMeasurements,
} from './preferences';
import { applicableRules, ruleEffects, type ApplicableRule } from './rules';
import { ZERO, add, compareScores, round, type FeedbackSignals, type Score } from './score';
import { MIN_ALTERNATIVES, fillSlot, type Choice, type Constraint, type FilledSlot, type Match } from './slots';
import { searchPhrase, sizeNote, swatch } from './text';

// The deterministic look engine (AI.md §3, FR-LOOK-03 … 15). Pure: plain inputs in, plain outputs
// out, no I/O, no clock, no randomness and no AI. The same input and content version always give the
// same looks; ties break on stable record IDs.
//
//   filterTemplates → fillSlots → applyRules and rank → signature (dedupe) → explain → alternatives
//   and search phrases

export interface EngineInput {
  request: RecommendationRequest;
  profile: ProfileWithMeasurements;
  /** `null` when the user has no signals or has switched `useInRecommendations` off. */
  signals: EngineSignals | null;
  feedbackSignals?: FeedbackSignals | null;
  library: StyleLibrary;
  /** A designed garment to build the looks around (ranking only, see design.ts). */
  design?: EngineDesign | null;
}

export interface GeneratedLook extends Explanation {
  templateId: string;
  paletteId: string;
  slots: LookSlot[];
  combinationSignature: string;
  /** Present when the request carried a design. */
  designMatch?: DesignMatch;
}

export interface EngineResult {
  looks: GeneratedLook[];
  defaultsApplied: string[];
  conflicts: PreferenceConflict[];
  limitedBy?: { constraint: string; suggestion: string };
  warnings: WarningCode[];
  contentVersion: string;
  /** Whether any appearance signal was used (stored with the look, never the values). */
  signalsUsed: boolean;
  departmentFiltered: boolean;
}

/** Everything that can limit results, most specific first (ties in `limitedBy` go to the earlier one). */
type Limit = 'wearType' | 'style' | Constraint;
const LIMITS: readonly Limit[] = ['wearType', 'style', 'department', 'dislikedColors', 'avoidedFabrics', 'coverage'];

const SUGGESTIONS: Record<Limit | 'occasion' | 'library', string> = {
  wearType: 'Choose another wear type, or none to see all three.',
  style: 'Try again without a style, or choose another style.',
  department: 'Choose “Show me everything” as your department to see looks from every department.',
  dislikedColors: 'Remove a colour from your disliked colours to widen the palettes.',
  avoidedFabrics: 'Remove a fabric from your avoided fabrics.',
  coverage: 'Review the coverage preferences in your profile.',
  occasion: 'There are no approved looks for this occasion yet. Try another occasion.',
  library: 'There are only a few approved looks for this request so far. Try another occasion or style.',
};

interface Candidate {
  template: Template;
  palette: Palette;
  combinationIndex: number;
  slots: FilledSlot[];
  score: Score;
  matched: Match[];
  supporting: Map<string, number>;
  signature: string;
}

/** Combination signature (FR-LOOK-13): template, palette and each slot's key attributes. */
export function signature(templateId: string, paletteId: string, slots: readonly FilledSlot[]): string {
  const key = slots.map(({ slot, choice: { spec } }) => [
    slot.slotId,
    spec.category,
    spec.colorId,
    spec.fabric ?? '',
    spec.silhouette ?? '',
    spec.pattern ?? '',
  ]);
  return createHash('sha256')
    .update(JSON.stringify([templateId, paletteId, key]))
    .digest('hex')
    .slice(0, 24);
}

/** filterTemplates: occasion, style, department and the request's wear types (hard filters). */
export function filterTemplates(library: StyleLibrary, request: RecommendationRequest, prefs: Preferences) {
  const eliminated = new Map<Limit, number>();
  const { occasion, style } = request;
  const anyDepartment = library.findTemplates({ occasion, style, department: 'any' });
  const inDepartment = library.findTemplates({ occasion, style, department: prefs.department });
  eliminated.set('department', anyDepartment.length - inDepartment.length);
  if (style) {
    const anyStyle = library.findTemplates({ occasion, department: prefs.department });
    eliminated.set('style', anyStyle.length - inDepartment.length);
  }
  const wear = request.wearType;
  const templates = wear
    ? inDepartment.filter((t) => {
        const type = templateWearType(t);
        return type !== null && wear.includes(type);
      })
    : inDepartment;
  eliminated.set('wearType', inDepartment.length - templates.length);
  const forOccasion = library.findTemplates({ occasion, department: 'any' }).length;
  return { templates: [...templates].sort((a, b) => a.id.localeCompare(b.id)), eliminated, forOccasion };
}

function palettesFor(template: Template, library: StyleLibrary, request: RecommendationRequest): Palette[] {
  const listed = template.compatiblePalettes.flatMap((id) => library.getPalette(id) ?? []);
  const palettes = listed.length > 0 ? listed : [...library.palettesForOccasion(request.occasion)];
  return palettes.sort((a, b) => a.id.localeCompare(b.id));
}

/** Look-level preferences and signals: styles, contrast, undertone and skin-tone affinity. */
function lookScore(
  template: Template,
  palette: Palette,
  contrast: string | null,
  request: RecommendationRequest,
  prefs: Preferences,
  feedbackSignals?: FeedbackSignals | null,
) {
  const matched: Match[] = [];
  let preference = 0;
  let signal = 0;
  let feedback = 0;
  if (!request.style) {
    for (const style of template.styles) {
      if (prefs.styles.has(style)) {
        preference += 1;
        matched.push({ attribute: 'preferredStyle', value: style });
      }
    }
  }
  if (contrast && prefs.contrast === contrast) {
    preference += 1;
    matched.push({ attribute: 'contrastPreference', value: contrast });
  }
  if (prefs.undertone && palette.undertoneAffinity.includes(prefs.undertone)) {
    signal += 1;
    matched.push({ attribute: 'undertone', value: prefs.undertone });
  }
  if (prefs.monkRange && palette.skinToneRange) {
    const [from, to] = palette.skinToneRange.split('-').map(Number) as [number, number];
    if (from <= prefs.monkRange[1] && prefs.monkRange[0] <= to) {
      signal += 1;
      matched.push({ attribute: 'skinTone', value: palette.skinToneRange });
    }
  }
  if (feedbackSignals) {
    feedback += feedbackSignals.templates.get(template.id) ?? 0;
    feedback += feedbackSignals.palettes.get(palette.id) ?? 0;
  }
  return { score: { preference, rule: 0, signal, feedback }, matched };
}

function buildCandidate(
  template: Template,
  palette: Palette,
  combination: { colors: readonly ColorId[]; contrastLevel: string } | null,
  combinationIndex: number,
  input: EngineInput,
  prefs: Preferences,
): Candidate | Constraint {
  const { request, library } = input;
  const scope = {
    occasion: request.occasion,
    styles: request.style ? [request.style] : template.styles,
    templateDepartment: template.department,
  };
  const usedColours = new Set<ColorId>();
  const usedGarmentColours = new Set<ColorId>();
  const slots: FilledSlot[] = [];
  for (const slot of template.slots) {
    const filled = fillSlot(slot, {
      prefs,
      mode: request.paletteMode,
      palette,
      combination: combination?.colors ?? null,
      rulesFor: (category) => applicableRules(library, category, scope, prefs),
      usedColours,
      usedGarmentColours,
    });
    if (typeof filled === 'string') {
      if (slot.optional) continue;
      return filled;
    }
    usedColours.add(filled.choice.spec.colorId);
    if (['top', 'bottom', 'one_piece', 'layer'].includes(slot.slot)) usedGarmentColours.add(filled.choice.spec.colorId);
    slots.push(filled);
  }
  // A look has the combination's contrast only if its worn colours do (contrast.ts); otherwise neither
  // the contrast preference nor contrast rules are claimed for it.
  const realised = combination && wearsContrast(combination, usedColours) ? combination : null;
  const look = lookScore(template, palette, realised?.contrastLevel ?? null, request, prefs, input.feedbackSignals);
  // Look-level rule effects: the contrast of the palette combination the look is built on (e.g. a
  // rule preferring medium contrast for work). Rules that apply to any of the look's garments count.
  const lookRules = new Map<string, ApplicableRule>();
  for (const { choice } of slots) {
    for (const r of applicableRules(library, choice.spec.category, scope, prefs)) lookRules.set(r.rule.id, r);
  }
  const contrast = realised
    ? ruleEffects(
        [...lookRules.values()].sort((a, b) => a.rule.id.localeCompare(b.rule.id)),
        { contrast: realised.contrastLevel },
      )
    : { score: ZERO, supporting: new Map<string, number>() };
  const supporting = new Map<string, number>(contrast.supporting);
  for (const { choice } of slots) {
    for (const [id, w] of choice.supporting) supporting.set(id, (supporting.get(id) ?? 0) + w);
  }
  return {
    template,
    palette,
    combinationIndex,
    slots,
    score: round(add(look.score, contrast.score, ...slots.map((s) => s.choice.score))),
    matched: [...slots.flatMap((s) => s.choice.matched), ...look.matched],
    supporting,
    signature: signature(template.id, palette.id, slots),
  };
}

function toLookSlot(filled: FilledSlot, prefs: Preferences): LookSlot {
  const alt = (choice: Choice) => ({
    lookSpec: choice.spec,
    swatches: [swatch(choice.spec.colorId)],
    searchPhrase: searchPhrase(choice.spec),
  });
  return {
    slotId: filled.slot.slotId,
    slot: filled.slot.slot,
    ...alt(filled.choice),
    sizeNote: sizeNote(filled.choice.spec.category, prefs.sizes, prefs.measurements),
    alternatives: filled.alternatives.map(alt),
  };
}

const byRank = (a: Candidate, b: Candidate) =>
  compareScores(a.score, b.score) ||
  a.template.id.localeCompare(b.template.id) ||
  a.palette.id.localeCompare(b.palette.id) ||
  a.combinationIndex - b.combinationIndex ||
  a.signature.localeCompare(b.signature);

const GARMENT_SLOTS = new Set(['top', 'bottom', 'one_piece', 'layer']);

/** What the user sees of a look's garments: every garment's specification, regardless of template or palette. */
function outfitKey(candidate: Candidate): string {
  return JSON.stringify(
    candidate.slots
      .filter(({ slot }) => GARMENT_SLOTS.has(slot.slot))
      .map(({ choice: { spec } }) => JSON.stringify(Object.entries(spec).sort(([a], [b]) => a.localeCompare(b))))
      .sort(),
  );
}

/**
 * Up to MAX_LOOKS looks with unique signatures (FR-LOOK-13) and no two with the same garments (two
 * templates or palettes can produce the same visible outfit). For variety, the best look of each wear
 * type is taken first, then of each template, then of each template and palette pair, then the rest
 * in rank order. With a design, looks that have the designed garment go through those passes before the rest.
 */
function select(
  candidates: Candidate[],
  compare: (a: Candidate, b: Candidate) => number = byRank,
  preferred: (c: Candidate) => boolean = () => true,
): Candidate[] {
  const ranked = [...candidates].sort(compare);
  const matching = ranked.filter(preferred);
  const nonMatching = ranked.filter((c) => !preferred(c));
  // If we have candidates matching the user's design, only pick matching garments (FR-LOOK-11)
  const groups = matching.length > 0 ? [matching] : [nonMatching];
  const picked: Candidate[] = [];
  const signatures = new Set<string>();
  const outfits = new Set<string>();
  const seen = { wearType: new Set<string>(), template: new Set<string>(), pair: new Set<string>() };
  const wearType = (c: Candidate) => templateWearType(c.template) ?? '';
  const pair = (c: Candidate) => `${c.template.id}|${c.palette.id}`;
  for (const [group, pass] of groups.flatMap((g) =>
    (['wearType', 'template', 'pair', 'fill'] as const).map((p) => [g, p] as const),
  )) {
    for (const candidate of group) {
      if (picked.length === MAX_LOOKS) return picked.sort(compare);
      if (signatures.has(candidate.signature) || outfits.has(outfitKey(candidate))) continue;
      if (pass === 'wearType' && seen.wearType.has(wearType(candidate))) continue;
      if (pass === 'template' && seen.template.has(candidate.template.id)) continue;
      if (pass === 'pair' && seen.pair.has(pair(candidate))) continue;
      picked.push(candidate);
      signatures.add(candidate.signature);
      outfits.add(outfitKey(candidate));
      seen.wearType.add(wearType(candidate));
      seen.template.add(candidate.template.id);
      seen.pair.add(pair(candidate));
    }
  }
  return picked.sort(compare);
}

export function generateLooks(input: EngineInput): EngineResult {
  const { request, library } = input;
  const prefs = resolvePreferences(input.profile, input.signals);
  const defaultsApplied = [...prefs.defaultsApplied];
  if (!request.style && !input.design && prefs.styles.size === 0) defaultsApplied.push('style');

  const { templates, eliminated, forOccasion } = filterTemplates(library, request, prefs);
  const candidates: Candidate[] = [];
  for (const template of templates) {
    // A template counts as eliminated by a hard constraint only if it produced no look at all.
    const failures = new Map<Constraint, number>();
    let produced = false;
    for (const palette of palettesFor(template, library, request)) {
      const usable = palette.combinations
        .map((combination, index) => ({ combination, index }))
        .filter(({ combination }) => combination.colors.every((c) => !prefs.disliked.has(c)));
      const seeds = usable.length > 0 ? usable : [{ combination: null, index: -1 }];
      for (const { combination, index } of seeds) {
        const candidate = buildCandidate(template, palette, combination, index, input, prefs);
        if (typeof candidate === 'string') failures.set(candidate, (failures.get(candidate) ?? 0) + 1);
        else {
          candidates.push(candidate);
          produced = true;
        }
      }
    }
    const cause = [...failures.entries()].sort(
      ([a, na], [b, nb]) => nb - na || LIMITS.indexOf(a) - LIMITS.indexOf(b),
    )[0];
    if (!produced && cause) eliminated.set(cause[0], (eliminated.get(cause[0]) ?? 0) + 1);
  }

  const { design } = input;
  const matches = new Map<Candidate, DesignMatch>();
  const matchOf = (c: Candidate) => {
    if (!matches.has(c))
      matches.set(
        c,
        matchDesign(
          c.slots.map((s) => s.choice.spec),
          design!,
        ),
      );
    return matches.get(c)!;
  };
  const selected = design
    ? select(
        candidates,
        (a, b) => designRank(matchOf(a)) - designRank(matchOf(b)) || byRank(a, b),
        (c) => matchOf(c).level !== 'none',
      )
    : select(candidates);

  const looks = selected.map((c): GeneratedLook => {
    const explanation = explain({
      template: c.template,
      palette: c.palette,
      occasion: request.occasion,
      matched: c.matched,
      supporting: c.supporting,
      conflicts: prefs.conflicts,
      library,
    });
    return {
      templateId: c.template.id,
      paletteId: c.palette.id,
      slots: c.slots.map((s) => toLookSlot(s, prefs)),
      ...explanation,
      combinationSignature: c.signature,
      ...(design ? { designMatch: matchOf(c) } : {}),
    };
  });

  let limitedBy: EngineResult['limitedBy'];
  if (looks.length < MAX_LOOKS) {
    const limit = LIMITS.reduce<Limit | null>(
      (top, l) => ((eliminated.get(l) ?? 0) > (top ? (eliminated.get(top) ?? 0) : 0) ? l : top),
      null,
    );
    const constraint = limit ?? (forOccasion === 0 ? 'occasion' : 'library');
    limitedBy = { constraint, suggestion: SUGGESTIONS[constraint] };
  }

  const warnings: WarningCode[] = [];
  if (defaultsApplied.length > 0) warnings.push('DEFAULTS_APPLIED');
  if (prefs.conflicts.length > 0) warnings.push('PREFERENCE_CONFLICT');
  if (limitedBy) warnings.push('INSUFFICIENT_MATCHES');
  if (looks.some((l) => l.slots.some((s) => s.alternatives.length < MIN_ALTERNATIVES))) {
    warnings.push('ALTERNATIVES_LIMITED');
  }

  return {
    looks,
    defaultsApplied,
    conflicts: prefs.conflicts,
    limitedBy,
    warnings,
    contentVersion: library.contentVersion,
    signalsUsed: prefs.signalsUsed,
    departmentFiltered: prefs.departmentFiltered,
  };
}
