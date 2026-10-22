'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  designFeatureIdSchema,
  featurePreferenceSchema,
  garmentTypeIdSchema,
  saveDesignSelectionRequestSchema,
  stylingGoalSchema,
  type DesignPreferencesResponse,
  type DesignSelectionItem,
  type SaveDesignSelectionRequest,
} from '@styleme/contracts';
import { z } from 'zod';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, sameOrigin, type FormState } from '@/lib/actions';
import { getAccessToken } from '@/lib/auth/session';

// Outfit Categories → design features (D-132): the visual customizer's Save Preferences and Reset, liking or
// hiding a feature, and styling goals. State-changing, so each action checks the Origin first.

async function call<T>(path: string, method: 'PUT' | 'DELETE', body?: unknown): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await getAccessToken();
  if (!token) redirect('/login');
  try {
    await apiRequest<T>(path, { method, body, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && err.code === 'INVALID_REQUEST')
      return { error: 'Some of these choices can’t be made together. Please change one and try again.' };
    return { error: 'Something went wrong. Please try again.' };
  }
  revalidatePath('/categories', 'layout');
  return { success: 'Saved.', issuedAt: Date.now() };
}

const saveSchema = z
  .object({ selection: saveDesignSelectionRequestSchema, stylingGoals: z.array(stylingGoalSchema).max(9) })
  .strict();

/** Save Preferences: the selected combination, and the styling goals that rank what is shown. */
export async function saveDesignAction(input: {
  selection: SaveDesignSelectionRequest;
  stylingGoals: string[];
}): Promise<FormState> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: 'Please choose from the options shown.' };
  const saved = await call<DesignSelectionItem>('/v1/design/selections', 'PUT', parsed.data.selection);
  if (saved?.error) return saved;
  const goals = await call<DesignPreferencesResponse>('/v1/design/preferences', 'PUT', {
    stylingGoals: parsed.data.stylingGoals,
  });
  if (goals?.error) return goals;
  return { success: 'Your preferences are saved.', issuedAt: Date.now() };
}

/** Reset: forget the saved combination for this garment. */
export async function resetDesignAction(garmentType: string, department?: string): Promise<FormState> {
  const parsed = garmentTypeIdSchema.safeParse(garmentType);
  if (!parsed.success) return { error: 'Please try again.' };
  const query = department === 'women' || department === 'men' ? `?department=${department}` : '';
  const result = await call(`/v1/design/selections/${parsed.data}${query}`, 'DELETE');
  return result?.error ? result : { success: 'Your selection is cleared.', issuedAt: Date.now() };
}

const preferenceSchema = z.object({ featureId: designFeatureIdSchema, preference: featurePreferenceSchema }).strict();

/** Like a feature (always shown), hide it (never shown), or clear that choice. */
export async function setFeaturePreferenceAction(featureId: string, preference: string): Promise<FormState> {
  const parsed = preferenceSchema.safeParse({ featureId, preference });
  if (!parsed.success) return { error: 'Please try again.' };
  return call<DesignPreferencesResponse>('/v1/design/preferences', 'PUT', { featurePreferences: [parsed.data] });
}
