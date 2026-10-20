// Prompt v1 for the optional explanation-wording step (FR-LOOK-16, D-67, AI.md §5). Versioned: a
// change in wording or rules is a new file (v2.ts) and a new version string, stored with each look.

export const WORDING_PROMPT_VERSION = 'wording-v1';

/**
 * Everything the AI step may see: the look's structured references and their public labels. Never
 * identity, profile free text, appearance signals, sizes, measurements or photos (AI rule 16).
 */
export interface WordingPayload {
  promptVersion: typeof WORDING_PROMPT_VERSION;
  occasion: string;
  template: { id: string; name: string };
  palette: { id: string; name: string };
  /** Approved rule rationales (the only styling claims the text may make). */
  rules: { id: string; rationale: string }[];
  /** Matched attribute tags, e.g. `{ ref: "likedColor:navy", label: "Navy", attribute: "likedColor" }`. */
  attributes: { ref: string; attribute: string; label: string }[];
  /** Every reference ID above; the reply must list exactly these. */
  references: string[];
}

export function buildWordingPrompt(payload: WordingPayload): string {
  return [
    'You reword a short outfit explanation for a fashion styling app.',
    'Use ONLY the facts in the JSON below: the template, the palette, the occasion, the rule rationales and the attribute labels.',
    'Do not add any other colour, fabric, garment, style, body, skin or size claim, product, brand, price, shop or link.',
    'Do not judge bodies or skin tones and do not tell the reader what they must not wear.',
    'Write 2 to 4 friendly sentences in British English, under 600 characters.',
    'Reply with JSON only: {"text": "<the explanation>", "references": [<every string from "references", each once>]}.',
    '',
    JSON.stringify(payload),
  ].join('\n');
}
