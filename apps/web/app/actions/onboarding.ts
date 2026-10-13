'use server';

import { redirect } from 'next/navigation';
import { cityIdSchema, indianPhoneSchema, setupPasswordRequestSchema, type OnboardingStep } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { pathForStep } from '@/lib/auth/session';
import {
  BLOCKED,
  errorState,
  fieldErrors,
  redirectIfSignedOut,
  sameOrigin,
  str,
  tokenOrLogin,
  type FormState,
} from '@/lib/actions';
import { saveProfileAction } from './profile';

// Server-authoritative onboarding (FR-ONB): the API decides the next step; the web only follows it.

/** Google sign-ups create a StyleMe password first (D-88). */
export async function setupPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = setupPasswordRequestSchema.safeParse({
    password: str(formData, 'password'),
    confirmPassword: str(formData, 'confirmPassword'),
  });
  if (!parsed.success) return { error: 'Please check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const token = await tokenOrLogin();
  let step: OnboardingStep;
  try {
    ({ onboardingStep: step } = await apiRequest<{ onboardingStep: OnboardingStep }>('/v1/auth/password/setup', {
      method: 'POST',
      body: parsed.data,
      token,
    }));
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
  redirect(pathForStep(step));
}

/**
 * Style profile step: saves the profile (and, for Google sign-ups, the city and optional phone), then
 * asks the API to mark the step complete.
 */
export async function completeStyleProfileAction(prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();

  const needsCity = formData.has('city');
  const city = cityIdSchema.safeParse(str(formData, 'city'));
  const phoneRaw = str(formData, 'phone').trim();
  const phone = phoneRaw ? indianPhoneSchema.safeParse(phoneRaw) : null;
  const errors: Record<string, string> = {};
  if (needsCity && !city.success) errors.city = 'Choose your city from the list.';
  if (phone && !phone.success) errors.phone = 'Enter a valid Indian mobile number, or leave it empty.';
  if (Object.keys(errors).length) return { error: 'Please check the highlighted fields.', fieldErrors: errors };

  const saved = await saveProfileAction(prev, formData);
  if (saved?.error) return saved;

  let phoneNotice = '';
  let step: OnboardingStep;
  try {
    if (needsCity && city.success) {
      await apiRequest('/v1/account/details', { method: 'PUT', body: { city: city.data }, token });
    }
    if (phone?.success) {
      try {
        await apiRequest('/v1/account/phone', { method: 'PUT', body: { phone: phone.data }, token });
        phoneNotice = 'sent';
      } catch (err) {
        // The phone is optional: onboarding continues; the user can verify it later in Settings.
        if (err instanceof ApiError && err.code === 'PROVIDER_NOT_CONFIGURED') phoneNotice = 'unavailable';
        else throw err;
      }
    }
    ({ step } = await apiRequest<{ step: OnboardingStep }>('/v1/onboarding/style-profile/complete', {
      method: 'POST',
      token,
    }));
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
  redirect(`${pathForStep(step)}${phoneNotice ? `?phone=${phoneNotice}` : ''}`);
}

/** Appearance step: optional. Saving signals happens in the form; this finishes the step (or skips). */
export async function completeAppearanceAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = await tokenOrLogin();
  let step: OnboardingStep;
  try {
    ({ step } = await apiRequest<{ step: OnboardingStep }>('/v1/onboarding/appearance/complete', {
      method: 'POST',
      token,
    }));
  } catch (err) {
    redirectIfSignedOut(err);
    return errorState(err);
  }
  redirect(step === 'complete' ? '/home?welcome=1' : pathForStep(step));
}
