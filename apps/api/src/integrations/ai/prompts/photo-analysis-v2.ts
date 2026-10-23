import type { ClothingPreference } from '@styleme/contracts';
import { buildBodyPrompt as buildBodyPromptV1, buildFacePrompt } from './photo-analysis-v1';

// Prompt v2 for photo analysis (D-131). The face prompt is unchanged from v1. The body prompt adds the
// height the user entered in their profile, when they gave one, as scale for judging proportions: a photo
// alone has no scale. Height is the only profile value sent, and only with the full-body photo.

export const PHOTO_ANALYSIS_PROMPT_VERSION = 'photo-analysis-v2';

export { buildFacePrompt };

/** Body type from one full-body photo and, when given, the user's height in centimetres. */
export function buildBodyPrompt(department: ClothingPreference, heightCm: number | null): string {
  const base = buildBodyPromptV1(department);
  const geometricGuide = [
    'PROPORTION MEASUREMENT RULES:',
    '- Compare visible shoulder width against hip width:',
    '  * If hips are visibly wider than shoulders and chest/bust -> classify as "pear" (or "spoon" / "triangle").',
    '  * If shoulders/chest/bust are visibly wider than hips -> classify as "inverted_triangle".',
    '  * If shoulders and hips are roughly balanced:',
    '    - Check waist indentation: An "hourglass" REQUIRES an obvious, dramatic inward waist cinch (waist clearly >=25% narrower than bust and hips).',
    '    - If clothing is loose, straight-cut, or there is no dramatic inward waist taper, classify as "rectangle", NOT "hourglass".',
    '    - If the torso/midsection is the widest point, classify as "oval" or "diamond".',
    '- CRITICAL: Do NOT bias toward or default to "hourglass". Most individuals wearing everyday clothes or uncinched garments have "rectangle" or "pear" silhouettes.',
  ].join('\n');

  let prompt = base.replace('\nNever choose any other value.', `\n${geometricGuide}\nNever choose any other value.`);

  if (heightCm !== null) {
    const height = [
      `The person's height, as they entered it, is ${heightCm} cm. Use it only as scale when judging the proportions`,
      'of the shoulders, bust or chest, waist and hips against the length of the torso and legs. Never comment on the height.',
    ].join(' ');
    prompt = prompt.replace('\nNever choose any other value.', `\nNever choose any other value.\n${height}`);
  }

  return prompt;
}
