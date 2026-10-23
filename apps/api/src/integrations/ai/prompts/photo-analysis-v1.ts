import {
  BODY_TYPE_DESCRIPTIONS,
  MONK_TONES,
  PHOTO_QUALITY_ISSUES,
  bodyTypeLabel,
  bodyTypesFor,
  type ClothingPreference,
} from '@styleme/contracts';

// Prompt v1 for photo analysis (D-129). Versioned: a change in wording or rules is a new file (v2.ts) and a
// new version string, stored with each analysis (`appearanceAnalyses.analysisVersion`). The model may only
// answer with the values listed here; the service validates every reply against the contracts.

export const PHOTO_ANALYSIS_PROMPT_VERSION = 'photo-analysis-v1';

const UNDERTONE_GUIDE = [
  '- "warm": golden, peachy or yellow undertone.',
  '- "cool": pink, red or bluish undertone.',
  '- "neutral": a balanced mix, neither clearly warm nor clearly cool.',
  '- "olive": a muted greenish or grey-green cast over the skin colour.',
].join('\n');

const QUALITY = `If the photo cannot be analysed reliably, reply {"usable": false, "qualityIssues": [...]} using only these values: ${PHOTO_QUALITY_ISSUES.map((q) => `"${q}"`).join(', ')}.`;

const RULES = [
  'Never identify the person, guess their age, ethnicity, health or weight, or comment on attractiveness.',
  'Describe only what is asked. Reply with JSON only, no other text.',
].join('\n');

/** Skin tone and undertone from one face photo, following StyleMe's analysis guidance. */
export function buildFacePrompt(): string {
  return [
    'You analyse one face photo for a fashion styling app that suggests clothing colours.',
    QUALITY,
    'Use "multiple_people" if more than one face is visible and "face_not_found" if no face is clearly visible or if key facial features (forehead, eyes, cheeks) are cropped out.',
    '',
    'Skin tone: judge the overall lightness or darkness of the facial skin, measured across several facial skin regions (forehead, both cheeks, jawline) and averaged. Choose the closest tone on the Monk Skin Tone scale:',
    MONK_TONES.map((t) => `- ${t.tone}: ${t.hex}`).join('\n'),
    '',
    'Undertone: choose exactly one of:',
    UNDERTONE_GUIDE,
    'How to judge the undertone:',
    '- Cheeks and jawline: the main evidence. Read the skin colour while discounting redness (flushing, blemishes) and shadows.',
    '- Forehead: helps assess the overall skin colour.',
    '- Below the eyes: only a weak clue, because shadows and darkness there distort colour.',
    '- Smile lines: not a reliable indicator; ignore them.',
    '- Hair colour and eye colour: supporting context only; they must never decide the result.',
    '- Under-eye darkness must never decide the result.',
    'Correct for the colour of the lighting where you can (for example warm indoor bulbs). If uneven or coloured lighting makes the result uncertain, lower the confidence.',
    '',
    'Confidence: "high" when lighting is even and several skin regions agree, "medium" when they mostly agree, "low" otherwise.',
    'Reply {"usable": true, "monkTone": <1-10>, "undertone": "warm" | "cool" | "neutral" | "olive", "confidence": "high" | "medium" | "low"}.',
    RULES,
  ].join('\n');
}

/** Body type from one full-body photo, choosing only from the user's Clothing Preference list. */
export function buildBodyPrompt(department: ClothingPreference): string {
  const types = bodyTypesFor(department);
  return [
    'You analyse one full-body photo for a fashion styling app that suggests clothing cuts.',
    QUALITY,
    'Use "body_not_fully_visible" unless the person is visible from head to feet, standing, facing the camera.',
    '',
    'Estimate the body type from the visible proportions of the shoulders, bust or chest, waist and hips. Choose exactly one of these IDs:',
    types.map((id) => `- "${id}" (${bodyTypeLabel(id)}): ${BODY_TYPE_DESCRIPTIONS[id]}`).join('\n'),
    'Never choose any other value.',
    'Loose or layered clothing hides proportions: lower the confidence when it does.',
    '',
    'Confidence: "high" when the outline is clear and the clothing is close-fitting, "medium" when mostly clear, "low" otherwise.',
    `Reply {"usable": true, "bodyType": ${types.map((t) => `"${t}"`).join(' | ')}, "confidence": "high" | "medium" | "low"}.`,
    RULES,
  ].join('\n');
}
