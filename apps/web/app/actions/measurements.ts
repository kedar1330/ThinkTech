'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  updateMeasurementsRequestSchema,
  type MeasurementsResponse,
  type UpdateMeasurementsRequest,
} from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { BLOCKED, sameOrigin } from '@/lib/actions';
import { getAccessToken } from '@/lib/auth/session';

// Body measurements (D-129). Values arrive in centimetres; saving the body-type measurements identifies the
// body type at once, and the page shows it.

export type MeasurementsActionResult = { error?: string; measurements?: MeasurementsResponse };

export async function saveMeasurementsAction(input: UpdateMeasurementsRequest): Promise<MeasurementsActionResult> {
  if (!(await sameOrigin())) return { error: BLOCKED!.error };
  const parsed = updateMeasurementsRequestSchema.safeParse(input);
  if (!parsed.success) return { error: 'Please check the values: one of them is outside the usual range.' };
  const token = await getAccessToken();
  if (!token) redirect('/login');
  let measurements: MeasurementsResponse;
  try {
    measurements = await apiRequest<MeasurementsResponse>('/v1/measurements', {
      method: 'PUT',
      body: parsed.data,
      token,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
    if (err instanceof ApiError && (err.code === 'CONFLICT' || err.code === 'INVALID_REQUEST')) {
      return { error: err.message };
    }
    return { error: 'Something went wrong. Your entries are kept — please try again.' };
  }
  revalidatePath('/profile');
  revalidatePath('/onboarding/appearance');
  revalidatePath('/home');
  return { measurements };
}
