'use server';

import {
  objectIdSchema,
  type OutfitDetail,
  type ProfileResponse,
  type RecommendationResponse,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';
import { requestFormToRequest } from '@/lib/discover/request-form';
import { inputsFromProfile, whatChanged } from '@/lib/discover/what-changed';

// Discover My Style look requests (FR-LOOK-01). State-changing (looks are stored as "suggested"), so the
// Origin is checked first. The looks come back in the state and are shown below the form.

export type LooksState = (NonNullable<FormState> & { result?: RecommendationResponse }) | undefined;

export async function requestLooksAction(_prev: LooksState, formData: FormData): Promise<LooksState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const form = requestFormToRequest({
    occasion: str(formData, 'occasion'),
    style: str(formData, 'style'),
    wearType: formData.getAll('wearType').filter((v): v is string => typeof v === 'string'),
    paletteMode: str(formData, 'paletteMode'),
    designGarment: str(formData, 'designGarment'),
    designOutfit: str(formData, 'designOutfit'),
    chosenColours: formData.getAll('chosenColours').filter((v): v is string => typeof v === 'string'),
  });
  if (!form.ok) return { error: 'Please check the highlighted fields.', fieldErrors: form.fieldErrors };

  try {
    const result = await apiRequest<RecommendationResponse>('/v1/recommendations', {
      method: 'POST',
      body: form.body,
      token,
    });
    return { result };
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
}

export type RegenerateState = (LooksState & { changes?: string[] }) | undefined;

const GONE = 'This look is no longer available.';

/**
 * Regenerate (#49): runs a look's original request again with the latest profile, and lists what changed
 * since that look was made. New looks are stored as "suggested"; the original look, saved or not, is only
 * read, so it stays exactly as it was (FR-OUT-05). The look's ID comes from a hidden `outfitId` field.
 */
export async function regenerateAction(prev: RegenerateState, formData: FormData): Promise<RegenerateState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'outfitId'));
  if (!id.success) return { error: GONE };

  try {
    const original = await apiRequest<OutfitDetail>(`/v1/outfits/${id.data}`, { token });
    const result = await apiRequest<RecommendationResponse>('/v1/recommendations', {
      method: 'POST',
      body: original.request,
      token,
    });
    // A new look carries the engine's own view of the inputs (including whether signals were used);
    // without one, compare with the profile as it is now.
    const first = result.looks[0];
    const now = first
      ? (await apiRequest<OutfitDetail>(`/v1/outfits/${first.id}`, { token })).inputsUsed
      : inputsFromProfile(await apiRequest<ProfileResponse>('/v1/profile', { token }));
    return { result, changes: whatChanged(original.inputsUsed, now) };
  } catch (err) {
    redirectIfSignedOut(err);
    // Keep the looks from an earlier regenerate on screen.
    return { ...errorState(err, { NOT_FOUND: GONE }), result: prev?.result, changes: prev?.changes };
  }
}
