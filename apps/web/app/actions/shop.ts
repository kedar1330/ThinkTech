'use server';

import { revalidatePath } from 'next/cache';
import {
  objectIdSchema,
  pickProductRequestSchema,
  slotIdSchema,
  type LookPick,
  type LookPicksResponse,
  type ProductListing,
  type UserShortlistItem,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';

// Shop My Look (#43): put one of the user's shortlist items on a slot of their saved look, or take it off.
// Both change data, so the Origin is checked first. The API checks that the item and the look are the
// user's, that the look is saved, that the slot exists and that it is free (AC-B4).

const GONE = 'This item or look is no longer available.';

export async function attachItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const itemId = objectIdSchema.safeParse(str(formData, 'itemId'));
  const outfitId = objectIdSchema.safeParse(str(formData, 'outfitId'));
  const slotId = slotIdSchema.safeParse(str(formData, 'slotId'));
  if (!outfitId.success || !slotId.success) return { error: GONE };
  if (!itemId.success) return { error: 'Choose an item from your shortlist.' };

  try {
    await apiRequest<UserShortlistItem>(`/v1/shortlist/${itemId.data}/attach`, {
      method: 'PUT',
      body: { outfitId: outfitId.data, slotId: slotId.data },
      token,
    });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err, { NOT_FOUND: GONE });
  }
  revalidatePath('/shop');
  return { success: 'Added to the look.' };
}

export async function detachItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const itemId = objectIdSchema.safeParse(str(formData, 'itemId'));
  if (!itemId.success) return { error: GONE };

  try {
    await apiRequest<UserShortlistItem>(`/v1/shortlist/${itemId.data}/attach`, { method: 'DELETE', token });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err, { NOT_FOUND: GONE });
  }
  revalidatePath('/shop');
  return { success: 'Taken off the look. It is still in your shortlist.' };
}

export type PicksResult = { picks: LookPick[]; error?: undefined } | { picks?: undefined; error: string };

/**
 * Picks one of the similar products for a garment of the look (#120), replacing an earlier pick. The API
 * accepts only a listing its search returned for that garment, so a pick is never a made-up product.
 */
export async function pickProductAction(
  outfitId: string,
  slotId: string,
  listing: ProductListing,
): Promise<PicksResult> {
  if (!(await sameOrigin())) return { error: BLOCKED?.error ?? GONE };
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(outfitId);
  const body = pickProductRequestSchema.safeParse({ slotId, listing });
  if (!id.success || !body.success) return { error: GONE };
  try {
    const { picks } = await apiRequest<LookPicksResponse>(`/v1/outfits/${id.data}/picks`, {
      method: 'PUT',
      body: body.data,
      token,
    });
    return { picks };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: errorState(err)?.error ?? GONE };
  }
}

/** Removes the pick for one garment of the look (#120). */
export async function unpickProductAction(outfitId: string, slotId: string): Promise<PicksResult> {
  if (!(await sameOrigin())) return { error: BLOCKED?.error ?? GONE };
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(outfitId);
  const slot = slotIdSchema.safeParse(slotId);
  if (!id.success || !slot.success) return { error: GONE };
  try {
    const { picks } = await apiRequest<LookPicksResponse>(`/v1/outfits/${id.data}/picks/${slot.data}`, {
      method: 'DELETE',
      token,
    });
    return { picks };
  } catch (err) {
    redirectIfSignedOut(err);
    return { error: errorState(err)?.error ?? GONE };
  }
}
