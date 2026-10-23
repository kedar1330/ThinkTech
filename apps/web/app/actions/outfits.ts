'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  objectIdSchema,
  outfitFeedbackRequestSchema,
  type DeletedResponse,
  type FeedbackRecordedResponse,
  type Look,
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

/**
 * "Shop this look" on a Discover My Style result (#115): saves the look (harmless if it is already saved),
 * so it becomes a Shop My Look tab, then opens it there.
 */
export async function shopLookAction(_prev: FormState, formData: FormData): Promise<FormState> {
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
  revalidatePath('/shop');
  redirect(`/shop?outfitId=${id.data}`);
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
