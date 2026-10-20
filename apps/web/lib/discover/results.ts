import { COLORS, FABRICS, MAX_LOOKS, type Look, type RecommendationResponse } from '@styleme/contracts';

// Turns the flags of a POST /v1/recommendations response into short messages for the results
// (FR-LOOK-09 … 11). Unknown names are skipped rather than shown raw.

export interface ResultNotice {
  id: string;
  text: string;
}

const DEFAULT_TEXT: Record<string, string> = {
  department: 'No department filter applied: looks can come from every department.',
  colors: "You haven't picked colours you like, so each look uses its palette's colours.",
  signals: 'Appearance signals are not used (none saved, or switched off).',
  sizes: 'No sizes saved yet, so each item asks you to add one.',
  style: 'No style chosen, so looks can be in any style.',
};

const CONFLICT_LISTS: Record<string, readonly { id: string; label: string }[]> = { colors: COLORS, fabrics: FABRICS };

/** Looks in engine order, without a repeated combination (AC-08). */
export function uniqueLooks(looks: readonly Look[]): Look[] {
  const seen = new Set<string>();
  return looks.filter((look) => !seen.has(look.combinationSignature) && seen.add(look.combinationSignature));
}

export function resultNotices(result: RecommendationResponse): ResultNotice[] {
  const notices: ResultNotice[] = [];
  const count = uniqueLooks(result.looks).length;
  const suggestion = result.limitedBy?.suggestion;

  if (count === 0) {
    notices.push({
      id: 'empty',
      text: `No looks matched this request. ${suggestion ?? 'Try another occasion or fewer filters.'}`,
    });
  } else if (count < MAX_LOOKS) {
    notices.push({
      id: 'insufficient',
      text: `Only ${count} ${count === 1 ? 'look' : 'looks'} matched this request.${suggestion ? ` ${suggestion}` : ''}`,
    });
  }

  for (const conflict of result.conflicts) {
    const list = CONFLICT_LISTS[conflict.field];
    if (!list) continue;
    const name = list.find((o) => o.id === conflict.value)?.label ?? conflict.value;
    notices.push({
      id: `conflict-${conflict.field}-${conflict.value}`,
      text: `You both like and avoid ${name.toLowerCase()}, so it is treated as avoided.`,
    });
  }

  for (const name of result.defaultsApplied) {
    const text = DEFAULT_TEXT[name];
    if (text) notices.push({ id: `default-${name}`, text });
  }
  return notices;
}
