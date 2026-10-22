'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { updateColourPreferencesRequestSchema, type ColourPreferencesResponse } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, sameOrigin, type FormState } from '@/lib/actions';
import { getAccessToken } from '@/lib/auth/session';

// Colour library (D-133): mark the selected colours as liked or avoided, or clear them. State-changing, so
// the Origin is checked first.

const SUCCESS = {
  liked: (n: number) => `${n === 1 ? 'Colour' : `${n} colours`} saved as liked.`,
  avoided: (n: number) => `${n === 1 ? 'Colour' : `${n} colours`} saved to avoid.`,
  none: (n: number) => `${n === 1 ? 'Colour' : `${n} colours`} cleared.`,
} as const;

export async function setColourPreferenceAction(colourIds: string[], preference: string): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = updateColourPreferencesRequestSchema.safeParse({ colourIds, preference });
  if (!parsed.success) return { error: 'Please choose up to 200 colours from the library.' };
  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest<ColourPreferencesResponse>('/v1/colours/preferences', {
      method: 'PUT',
      body: parsed.data,
      token,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && err.code === 'INVALID_REQUEST') return { error: err.message };
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/palette/colours', 'layout');
  return { success: SUCCESS[parsed.data.preference](parsed.data.colourIds.length), issuedAt: Date.now() };
}
