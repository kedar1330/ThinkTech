'use server';

import { revalidatePath } from 'next/cache';
import { objectIdSchema, slotIdSchema, type UserShortlistItem } from '@styleme/contracts';
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
