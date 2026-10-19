import { emptyProfile } from '../../src/services/profile.service';
import { toEvaluationProfile, type EvaluationProfile, type EvaluationProfileInput } from '../../src/services/engine';
import type { ProfileResponse } from '@styleme/contracts';

// Synthetic profile builders for the engine tests and the evaluation entry point (#34). No real
// person's data: every value is chosen to hit an engine edge case. The #54 evaluation dataset builds
// on the same shape (`EvaluationProfileInput`), with founder-reviewed profiles.

/** A full engine profile: the empty profile with `overrides` on top (department `women` by default). */
export function buildProfile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return { ...emptyProfile(), department: 'women', ...overrides };
}

/** One evaluation profile; `profile` takes `PUT /v1/profile` fields, so omitted fields stay empty. */
export function evaluationProfile(
  id: string,
  request: EvaluationProfileInput['request'],
  profile: Partial<EvaluationProfileInput['profile']> = {},
  signals: EvaluationProfileInput['signals'] = null,
): EvaluationProfile {
  return toEvaluationProfile({ id, request, profile: { department: 'women', ...profile }, signals });
}

/**
 * Edge-case profiles, one per engine branch (TESTING.md §6 lists the kinds of profile #54 needs):
 * missing inputs, every department, conflicts, hard constraints, explore mode, signals on and off,
 * and requests nothing can satisfy. Run them on any library with `runEvaluation`.
 */
export function edgeCaseProfiles(): EvaluationProfile[] {
  return [
    evaluationProfile('EDGE-01-occasion-only', { occasion: 'everyday' }),
    evaluationProfile('EDGE-02-no-department', { occasion: 'everyday' }, { department: null }),
    evaluationProfile('EDGE-03-men', { occasion: 'everyday' }, { department: 'men' }),
    evaluationProfile('EDGE-04-any-department', { occasion: 'work' }, { department: 'any' }),
    evaluationProfile(
      'EDGE-05-liked-and-disliked',
      { occasion: 'everyday' },
      { likedColors: ['navy', 'rust'], dislikedColors: ['navy'] },
    ),
    evaluationProfile(
      'EDGE-06-many-dislikes',
      { occasion: 'everyday', paletteMode: 'explore' },
      { dislikedColors: ['navy', 'cream', 'rust', 'white', 'grey', 'tan'] },
    ),
    evaluationProfile(
      'EDGE-07-fabric-conflict',
      { occasion: 'work' },
      { fabricPreferences: { liked: ['cotton', 'linen'], avoided: ['cotton'] } },
    ),
    evaluationProfile(
      'EDGE-08-full-coverage',
      { occasion: 'everyday' },
      { coveragePreferences: { minSleeveLength: 'full', minGarmentLength: 'knee', minNecklineCoverage: 'high' } },
    ),
    evaluationProfile('EDGE-09-explore', { occasion: 'everyday', paletteMode: 'explore' }, { likedColors: ['teal'] }),
    evaluationProfile(
      'EDGE-10-preferences',
      { occasion: 'everyday' },
      {
        likedColors: ['lavender', 'tan'],
        contrastPreference: 'high',
        silhouettePreferences: ['wide_leg'],
        preferredStyles: ['casual'],
        sizes: { ethnicTops: { letter: 'M' }, shoes: { uk: 6 } },
      },
    ),
    evaluationProfile(
      'EDGE-11-signals-on',
      { occasion: 'everyday', style: 'casual' },
      {},
      { undertone: 'cool', skinTone: '3-4', bodyProportions: 'hips_wider_than_shoulders' },
    ),
    evaluationProfile(
      'EDGE-12-signals-unsure',
      { occasion: 'everyday' },
      {},
      { undertone: 'not_sure', skinTone: null, bodyProportions: 'prefer_not_to_say' },
    ),
    evaluationProfile('EDGE-13-style', { occasion: 'work', style: 'classic' }, { department: 'any' }),
    evaluationProfile(
      'EDGE-14-restrictive-wear',
      { occasion: 'everyday', wearType: ['indian'] },
      { department: 'men' },
    ),
    evaluationProfile('EDGE-15-festive', { occasion: 'festive' }, { likedColors: ['emerald'] }),
    evaluationProfile('EDGE-16-date', { occasion: 'date' }),
  ];
}
