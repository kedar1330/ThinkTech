// Inclusive-language check (FR-STY-05, FR-LOOK-19, AI.md §3). Applied by the linter to record text
// and, later, to every explanation shown to a user. Text that judges a body or skin tone, or tells
// the user what they must not wear, is rejected. Keep patterns specific so plain effect descriptions
// ("a V-neck creates a longer line") pass.

const JUDGEMENTAL_PATTERNS: readonly RegExp[] = [
  /\bun-?flattering\b/i,
  /\bnot (?:suitable |right |good |meant )?for (?:your|a|an|their) (?:body|figure|shape|skin)/i,
  /\b(?:wrong|bad|unsuitable|inappropriate) for (?:your|a|an|their) (?:body|figure|shape|skin|complexion)/i,
  /\bobjectively unsuitable\b/i,
  /\byou (?:should|must) (?:avoid|never)\b/i,
  /\bnever wear\b/i,
  /\bhides? (?:your|the|their) /i,
  /\bcamouflag/i,
  /\bflaws?\b/i,
  /\bproblem (?:area|zone)s?\b/i,
  /\bimperfections?\b/i,
  /\b(?:look|appear|seem) (?:slimmer|thinner|skinnier|fairer|lighter[- ]skinned|less (?:fat|dark))\b/i,
  /\btoo (?:fat|thin|skinny|short|tall|dark|fair|big|heavy|curvy)\b/i,
  /\bfairness\b/i,
  /\bskin[- ]lightening\b/i,
  /\b(?:fat|ugly|unattractive)\b/i,
];

/** Returns the judgemental phrases found in `text` (empty when the text passes). */
export function findJudgementalLanguage(text: string): string[] {
  const found: string[] = [];
  for (const pattern of JUDGEMENTAL_PATTERNS) {
    const match = pattern.exec(text);
    if (match) found.push(match[0]);
  }
  return found;
}
