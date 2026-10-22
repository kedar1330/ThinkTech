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
  if (heightCm === null) return base;
  const height = [
    `The person's height, as they entered it, is ${heightCm} cm. Use it only as scale when judging the proportions`,
    'of the shoulders, bust or chest, waist and hips against the length of the torso and legs. Never comment on the height.',
  ].join(' ');
  // Right after the list of body types to choose from.
  return base.replace('\nNever choose any other value.', `\nNever choose any other value.\n${height}`);
}
