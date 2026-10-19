'use server';

import type { RecommendationResponse } from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { BLOCKED, errorState, redirectIfSignedOut, sameOrigin, str, tokenOrLogin, type FormState } from '@/lib/actions';
import { requestFormToRequest } from '@/lib/discover/request-form';

// Discover My Style look requests (FR-LOOK-01). State-changing (looks are stored as "suggested"), so the
// Origin is checked first.

export async function requestLooksAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  const form = requestFormToRequest({
    occasion: str(formData, 'occasion'),
    style: str(formData, 'style'),
    wearType: formData.getAll('wearType').filter((v): v is string => typeof v === 'string'),
    paletteMode: str(formData, 'paletteMode'),
  });
  if (!form.ok) return { error: 'Please check the highlighted fields.', fieldErrors: form.fieldErrors };

  let result: RecommendationResponse;
  try {
    result = await apiRequest<RecommendationResponse>('/v1/recommendations', {
      method: 'POST',
      body: form.body,
      token,
    });
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }

  // The results page (#47) is not built yet; it will replace this message with a redirect.
  const count = result.looks.length;
  if (count === 0)
    return { error: 'We could not find looks that match everything you chose. Try another occasion or fewer filters.' };
  return {
    success: `We found ${count} ${count === 1 ? 'look' : 'looks'} for this request. Viewing them here is coming soon.`,
  };
}
