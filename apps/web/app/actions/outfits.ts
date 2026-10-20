'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  objectIdSchema,
  outfitFeedbackRequestSchema,
  type DeletedResponse,
  type FeedbackRecordedResponse,
  type Look,
  type LookSlot,
  type OutfitDetail,
  type RecommendationResponse,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';

// Saved Outfits (FR-OUT-01, -03, -04, issue #42). All actions change state, so the Origin is checked
// first. The look's ID comes from a hidden `outfitId` field; the API only ever acts on the signed-in
// user's own looks.

const GONE = 'This look is no longer available.';

/** Saves a suggested look (removes its 7-day expiry). Used by the results page (#47). */
export async function saveOutfitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'outfitId'));
  if (!id.success) return { error: GONE };

  try {
    await apiRequest<Look>(`/v1/outfits/${id.data}/save`, { method: 'POST', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err, { NOT_FOUND: GONE });
  }
  revalidatePath('/saved');
  return { success: 'Saved to Saved Outfits.' };
}

/** Removes a look. From its details page (`from=detail`) the user goes back to the list. */
export async function removeOutfitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'outfitId'));
  if (!id.success) return { error: GONE };

  try {
    await apiRequest<DeletedResponse>(`/v1/outfits/${id.data}`, { method: 'DELETE', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err, { NOT_FOUND: GONE });
  }
  revalidatePath('/saved');
  if (str(formData, 'from') === 'detail') redirect('/saved');
  return { success: 'Look removed.' };
}

/**
 * Records feedback on a look (FR-OUT-04, issue #42). One current reaction per look; sending again
 * replaces previous feedback. Accepts 'love_it' or 'not_for_me' with an optional fixed reason.
 */
export async function feedbackOutfitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'outfitId'));
  if (!id.success) return { error: GONE };

  const value = str(formData, 'value');
  const reasonRaw = str(formData, 'reason');
  const reason = reasonRaw ? reasonRaw : undefined;

  const parsed = outfitFeedbackRequestSchema.safeParse({ value, reason });
  if (!parsed.success) return { error: 'Please choose an allowed reaction.' };

  try {
    await apiRequest<FeedbackRecordedResponse>(`/v1/outfits/${id.data}/feedback`, {
      method: 'POST',
      body: parsed.data,
      token,
    });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err, { NOT_FOUND: GONE });
  }
  revalidatePath('/saved');
  return { success: 'Feedback recorded.' };
}

export type FreshAlternativesState =
  | {
      error?: string;
      slots?: LookSlot[];
    }
  | undefined;

/**
 * Gets fresh alternatives from the engine for a saved look's request (#42).
 * Runs the look's original request through the engine with the current profile and feedback signals,
 * returning fresh slot alternatives.
 */
export async function getFreshAlternativesAction(
  _prev: FreshAlternativesState,
  formData: FormData,
): Promise<FreshAlternativesState> {
  if (!(await sameOrigin())) return { error: 'Request blocked.' };
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'outfitId'));
  if (!id.success) return { error: GONE };

  try {
    const look = await apiRequest<OutfitDetail>(`/v1/outfits/${id.data}`, { token });
    const rec = await apiRequest<RecommendationResponse>('/v1/recommendations', {
      method: 'POST',
      body: look.request,
      token,
    });
    const matched = rec.looks.find((l) => l.templateId === look.templateId) ?? rec.looks[0];
    if (!matched) return { error: 'Could not generate alternatives for this look.' };
    return { slots: matched.slots };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: err instanceof Error ? err.message : 'Could not get fresh alternatives.' };
  }
}
