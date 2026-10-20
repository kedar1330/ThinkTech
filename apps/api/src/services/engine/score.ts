// Scores follow the precedence of FR-LOOK-08 by comparing tiers in order, not by adding them: an
// explicit preference always outweighs any number of rule effects, and a rule effect always
// outweighs any number of appearance signals. Hard constraints are filters, never scores. Look
// feedback (D-115, #42) is the fourth, lowest tier.

export interface Score {
  /** Explicit profile preferences: liked colours and fabrics, silhouettes, fit, contrast, styles. */
  preference: number;
  /** Approved styling and fabric rule effects, plus palette coordination. */
  rule: number;
  /** Self-reported appearance signals, only while `useInRecommendations` is on. */
  signal: number;
  /** Feedback on earlier looks (D-115, #42): softest ranking signal. */
  feedback: number;
}

export const ZERO: Score = { preference: 0, rule: 0, signal: 0, feedback: 0 };

export interface FeedbackSignals {
  /** Net score per template: +1 for love_it, -1 for not_for_me */
  templates: ReadonlyMap<string, number>;
  /** Net score per palette: +1 for love_it, -1 for not_for_me */
  palettes: ReadonlyMap<string, number>;
}

/**
 * Rule-tier weights for palette coordination (D-19). They sit beside the knowledge-base rule weights
 * (0 – 1) and are tuned on the evaluation set (TESTING.md §6) together with them.
 */
export const COORDINATION = {
  /** A slot colour that belongs to the look's palette combination. */
  inCombination: 0.5,
  /** In explore mode: a colour from the look's palette rather than from the wider vocabulary. */
  inPalette: 0.25,
  /** The same colour on two garment slots, when another colour would do as well. */
  repeatedColour: -0.25,
} as const;

export function add(...scores: Score[]): Score {
  return scores.reduce(
    (sum, s) => ({
      preference: sum.preference + s.preference,
      rule: sum.rule + s.rule,
      signal: sum.signal + s.signal,
      feedback: sum.feedback + s.feedback,
    }),
    ZERO,
  );
}

/** Negative when `a` ranks before `b` (higher first), comparing tier by tier. */
export function compareScores(a: Score, b: Score): number {
  return b.preference - a.preference || b.rule - a.rule || b.signal - a.signal || b.feedback - a.feedback;
}

/** True when anything (a preference, rule or signal) supports the choice. */
export function isSupported(score: Score): boolean {
  return score.preference > 0 || score.rule > 0 || score.signal > 0 || score.feedback > 0;
}

/** Floating-point sums can differ in the last bit; round so equal scores compare as equal. */
export function round(score: Score): Score {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return {
    preference: r(score.preference),
    rule: r(score.rule),
    signal: r(score.signal),
    feedback: r(score.feedback),
  };
}
