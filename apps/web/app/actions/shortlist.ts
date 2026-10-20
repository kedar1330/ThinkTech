'use server';

import { revalidatePath } from 'next/cache';
import { objectIdSchema, type DeletedResponse, type UserShortlistItem } from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';
import { shortlistFormToRequest } from '@/lib/shop/shortlist-form';

// Shortlist of items the user found elsewhere (FR-LIST). Both actions change data, so the Origin is
// checked first. The link is passed through as typed; the web app never requests it either.

export async function addShortlistItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const form = shortlistFormToRequest({
    name: str(formData, 'name'),
    priceEntered: str(formData, 'priceEntered'),
    url: str(formData, 'url'),
    note: str(formData, 'note'),
  });
  if (!form.ok) return { error: 'Please check the highlighted fields.', fieldErrors: form.fieldErrors };

  let item: UserShortlistItem;
  try {
    item = await apiRequest<UserShortlistItem>('/v1/shortlist', { method: 'POST', body: form.body, token });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
  revalidatePath('/shortlist');
  return { success: `“${item.name}” was added to your shortlist.`, issuedAt: Date.now() };
}

export async function removeShortlistItemAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const id = objectIdSchema.safeParse(str(formData, 'id'));
  if (!id.success) return { error: 'This item could not be removed. Please reload the page and try again.' };

  try {
    await apiRequest<DeletedResponse>(`/v1/shortlist/${id.data}`, { method: 'DELETE', token });
  } catch (err) {
    redirectIfSignedOut(err);
    // Already gone (for example removed in another tab): refresh the list so it disappears here too.
    revalidatePath('/shortlist');
    return errorState(err, { NOT_FOUND: 'This item was already removed.' });
  }
  revalidatePath('/shortlist');
  return { success: 'The item was removed from your shortlist.', issuedAt: Date.now() };
}
