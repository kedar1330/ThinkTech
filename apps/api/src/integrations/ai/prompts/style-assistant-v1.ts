import { ASSISTANT_INTENTS, OCCASION_IDS, STYLE_IDS, WEAR_TYPE_IDS, type AssistantIntent } from '@styleme/contracts';

// Style Assistant prompts (D-136). Version these: a change in wording is a new file and a new version.
// The planner sees only the user's own words. The reply writer also sees the facts the StyleMe feature
// returned (garments, colour names, palette and design titles), never photos, measurements, height or the
// skin tone, undertone and body type labels.

export const STYLE_ASSISTANT_PROMPT_VERSION = 'style-assistant-v1';

export interface PlanPayload {
  message: string;
  /** The user's earlier questions in this conversation, oldest first (at most three). */
  earlier: string[];
}

export interface ReplyPayload {
  question: string;
  intent: AssistantIntent;
  /** What the feature returned, as plain sentences built by StyleMe. Empty for a general question. */
  facts: string[];
}

const INTENT_GUIDE: Record<AssistantIntent, string> = {
  looks: 'outfit or look suggestions for an occasion, event, season or style',
  colours: 'which colours suit the user, or colours to wear or avoid',
  palettes: 'colour palettes or colour combinations',
  design: 'designing, customising or stitching a new garment for a tailor',
  saved: 'the outfits or looks the user has saved',
  shop: 'buying, shopping, stores or prices for an outfit',
  try_on: 'trying an outfit on virtually or seeing it on themselves',
  profile: 'their profile, photos, measurements, skin tone or body type settings',
  general: 'any other fashion or styling question (how to style, fabric care, what goes with what)',
  help: 'greetings, or what the assistant can do',
};

export function buildPlanPrompt({ message, earlier }: PlanPayload): string {
  return [
    'You route questions in StyleMe, an Indian fashion styling app. Choose the one intent that best fits the',
    'latest question, and fill in the details the question states. Do not guess details the user did not give.',
    '',
    'Intents:',
    ...ASSISTANT_INTENTS.map((id) => `- ${id}: ${INTENT_GUIDE[id]}`),
    '',
    `occasion: one of ${OCCASION_IDS.join(', ')}, or null. Map events to these (a sangeet or reception is`,
    'wedding; Diwali, Eid or a puja is festive; office or an interview is work; a holiday is travel; a',
    'season alone, such as summer, with no event is everyday).',
    `style: one of ${STYLE_IDS.join(', ')}, or null.`,
    `wearTypes: any of ${WEAR_TYPE_IDS.join(', ')} the user asked for (ethnic or traditional is indian), or [].`,
    'designDescription: for the design intent only, the garment to design in one clear sentence (garment,',
    'fabric, colour, neckline, sleeves, length, details) using only what the user said; otherwise null.',
    '',
    'Earlier questions in this conversation, for context only:',
    earlier.length ? earlier.map((q) => `- ${JSON.stringify(q)}`).join('\n') : '- none',
    '',
    `Latest question: ${JSON.stringify(message)}`,
    '',
    'Reply with JSON only: {"intent": "...", "occasion": null, "style": null, "wearTypes": [], "designDescription": null}',
  ].join('\n');
}

export function buildReplyPrompt({ question, intent, facts }: ReplyPayload): string {
  return [
    'You are the StyleMe Style Assistant, a friendly fashion stylist for Indian users. Write the reply to the',
    'question below in plain text (no markdown, no lists of more than four items), at most 90 words, warm and',
    'specific, in Indian English.',
    '',
    'Rules:',
    '- Use only the facts given. Never invent looks, garments, colours, products, brands, stores, prices,',
    '  ratings, reviews, availability or discounts.',
    '- Never guess or mention the user’s skin tone, undertone, body type, size, height or measurements.',
    '- When the facts list looks, colours, palettes or a design, the app shows them as cards under your reply,',
    '  so refer to them ("the looks below") instead of repeating every detail. With no such facts, never',
    '  mention looks, cards or anything "below".',
    '- For a general styling question with no facts, give brief general advice and say it is general',
    '  advice, not based on their profile.',
    '- If the question is not about fashion, clothing, colours or styling, say politely that you can only',
    '  help with styling.',
    '',
    `Intent: ${intent}`,
    'Facts from StyleMe:',
    facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- none',
    '',
    `Question: ${JSON.stringify(question)}`,
    '',
    'Reply with JSON only: {"reply": "..."}',
  ].join('\n');
}
