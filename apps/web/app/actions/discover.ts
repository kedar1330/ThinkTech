'use server';

import type { RecommendationResponse } from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';
import { requestFormToRequest } from '@/lib/discover/request-form';

// Discover My Style look requests (FR-LOOK-01). State-changing (looks are stored as "suggested"), so the
// Origin is checked first. The looks come back in the state and are shown below the form.

export type LooksState = (NonNullable<FormState> & { result?: RecommendationResponse }) | undefined;

export async function requestLooksAction(_prev: LooksState, formData: FormData): Promise<LooksState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const form = requestFormToRequest({
    occasion: str(formData, 'occasion'),
    style: str(formData, 'style'),
    wearType: formData.getAll('wearType').filter((v): v is string => typeof v === 'string'),
    paletteMode: str(formData, 'paletteMode'),
  });
  if (!form.ok) return { error: 'Please check the highlighted fields.', fieldErrors: form.fieldErrors };

  try {
    const result = await apiRequest<RecommendationResponse>('/v1/recommendations', {
      method: 'POST',
      body: form.body,
      token,
    });
    return { result };
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
}
