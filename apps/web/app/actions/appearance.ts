'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { UpdateAppearanceRequest } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { isAllowedOrigin } from '@/lib/auth/origin';
import { getAccessToken } from '@/lib/auth/session';
import { CLEAR_ALL_SIGNALS, appearanceFormToRequest } from '@/lib/profile/appearance-form';
import type { FormState } from './auth';

// Self-reported appearance signals (FR-SIG). State-changing, so each action checks the Origin first.

const BLOCKED: FormState = { error: 'This request was blocked. Please reload the page and try again.' };

async function save(body: UpdateAppearanceRequest, success: string): Promise<FormState> {
  if (!isAllowedOrigin((await headers()).get('origin'), process.env.AUTH_URL)) return BLOCKED;
  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest('/v1/appearance', { method: 'PUT', body, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && err.code === 'INVALID_REQUEST')
      return { error: 'Please choose from the options shown.' };
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  return { success };
}

export async function saveAppearanceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const form = appearanceFormToRequest({
    monkFrom: String(formData.get('monkFrom') ?? ''),
    monkTo: String(formData.get('monkTo') ?? ''),
    undertone: String(formData.get('undertone') ?? ''),
    bodyProportions: String(formData.get('bodyProportions') ?? ''),
    useInRecommendations: formData.get('useInRecommendations') ? 'on' : undefined,
  });
  if (!form.ok) return { error: form.error };
  return save(form.body, 'Saved.');
}

export async function clearAppearanceAction(): Promise<FormState> {
  return save(CLEAR_ALL_SIGNALS, 'All appearance signals have been deleted.');
}
