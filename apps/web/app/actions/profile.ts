'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { FABRIC_IDS } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { isAllowedOrigin } from '@/lib/auth/origin';
import { getAccessToken } from '@/lib/auth/session';
import { profileFormToRequest } from '@/lib/profile/profile-form';
import type { FormState } from '@/lib/actions';

// My Profile basics (FR-PROF, D-129). State-changing, so the Origin is checked first.

export async function saveProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isAllowedOrigin((await headers()).get('origin'), process.env.AUTH_URL)) {
    return { error: 'This request was blocked. Please reload the page and try again.' };
  }
  const form = profileFormToRequest(formData, { fabrics: FABRIC_IDS });
  if (!form.ok) return { error: form.error };

  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest('/v1/profile', { method: 'PUT', body: form.body, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && err.code === 'INVALID_REQUEST')
      return { error: 'Please choose from the options shown.' };
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  revalidatePath('/home');
  return { success: 'Saved.' };
}
