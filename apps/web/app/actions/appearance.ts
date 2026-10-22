'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  bodyTypeSchema,
  confirmAppearanceRequestSchema,
  updateAppearanceRequestSchema,
  type AppearanceResponse,
  type ConfirmAppearanceRequest,
  type UpdateAppearanceRequest,
} from '@styleme/contracts';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, sameOrigin, type FormState } from '@/lib/actions';
import { getAccessToken } from '@/lib/auth/session';

// Skin tone, undertone and body type (FR-SIG, D-129): the user's own choice, a correction of a photo or
// measurement result, or confirming that result. State-changing, so each action checks the Origin first.

async function call(path: string, method: 'PUT' | 'POST', body: unknown, success: string): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest<AppearanceResponse>(path, { method, body, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && err.code === 'INVALID_REQUEST')
      return { error: 'Please choose from the options shown.' };
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/profile');
  revalidatePath('/onboarding/appearance');
  revalidatePath('/home');
  return { success, issuedAt: Date.now() };
}

const manualSkinToneSchema = z
  .object({
    monkTone: z.number().int().min(1).max(10),
    undertone: z.enum(['warm', 'cool', 'neutral', 'olive']),
  })
  .strict();

/** Manual skin tone (one Monk tone) and undertone. */
export async function saveSkinToneAction(input: { monkTone: number; undertone: string }): Promise<FormState> {
  const parsed = manualSkinToneSchema.safeParse(input);
  if (!parsed.success) return { error: 'Choose a skin tone and an undertone.' };
  const body: UpdateAppearanceRequest = {
    skinTone: { value: { monkRange: `${parsed.data.monkTone}-${parsed.data.monkTone}` } },
    undertone: { value: parsed.data.undertone },
  };
  return call('/v1/appearance', 'PUT', body, 'Your skin tone and undertone are saved.');
}

/** Manual body type, or a correction of a photo or measurement result. */
export async function saveBodyTypeAction(bodyType: string): Promise<FormState> {
  const parsed = bodyTypeSchema.safeParse(bodyType);
  if (!parsed.success) return { error: 'Choose a body type from the list.' };
  return call('/v1/appearance', 'PUT', { bodyType: { value: parsed.data } }, 'Your body type is saved.');
}

/** The user reviewed a photo or measurement result and it is right. */
export async function confirmAppearanceAction(attributes: ConfirmAppearanceRequest['attributes']): Promise<FormState> {
  const parsed = confirmAppearanceRequestSchema.safeParse({ attributes });
  if (!parsed.success) return { error: 'Please try again.' };
  return call('/v1/appearance/confirm', 'POST', parsed.data, 'Thanks — confirmed.');
}

export async function setUseInRecommendationsAction(on: boolean): Promise<FormState> {
  const body = updateAppearanceRequestSchema.parse({ useInRecommendations: on === true });
  return call('/v1/appearance', 'PUT', body, on ? 'Used in recommendations.' : 'Not used in recommendations.');
}

/** Clears skin tone, undertone and body type; the toggle and photos are left as they are. */
export async function clearAppearanceAction(): Promise<FormState> {
  const body: UpdateAppearanceRequest = {
    skinTone: { value: null },
    undertone: { value: null },
    bodyProportions: { value: null },
    bodyType: { value: null },
  };
  return call('/v1/appearance', 'PUT', body, 'Your skin tone, undertone and body type have been cleared.');
}
