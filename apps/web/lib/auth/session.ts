import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { OnboardingStep, UserResponse } from '@styleme/contracts';
import { ApiError, apiRequest } from '@/lib/api/server';
import { SESSION_MAX_AGE_REMEMBER_SECONDS, cookieName, cookieOptions } from './cookies';

// Session handling on the Next.js server (BFF, D-06, D-91). The API access token lives only in an
// HttpOnly cookie that browser code can't read; every protected page confirms it with the API, which
// checks the server-side session record, so logout and revocation take effect immediately.

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(cookieName('session'))?.value ?? null;
}

/** Remember Me: a 30-day cookie; otherwise a browser-session cookie (server limit 24 hours). */
export async function setSession(accessToken: string, remember: boolean): Promise<void> {
  (await cookies()).set(
    cookieName('session'),
    accessToken,
    cookieOptions(remember ? SESSION_MAX_AGE_REMEMBER_SECONDS : undefined),
  );
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(cookieName('session'));
}

/** The signed-in user, or null when there is no valid session. */
export async function getCurrentUser(): Promise<{ user: UserResponse; accessToken: string } | null> {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  try {
    const user = await apiRequest<UserResponse>('/v1/auth/me', { token: accessToken });
    return { user, accessToken };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

const STEP_PATH: Record<OnboardingStep, string> = {
  set_password: '/onboarding/password',
  style_profile: '/onboarding/style-profile',
  appearance: '/onboarding/appearance',
  complete: '/home',
};

/** Where a signed-in user belongs next (FR-ONB-02): the next incomplete step, or Personalized Home. */
export function pathForStep(step: OnboardingStep): string {
  return STEP_PATH[step];
}

/** For any signed-in page: redirects to login when there is no valid session. */
export async function requireUser(): Promise<{ user: UserResponse; accessToken: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect('/login');
  const current = await getCurrentUser();
  if (!current) redirect('/login?expired=1');
  return current;
}

/** For app pages after onboarding: sends users with unfinished onboarding to their next step. */
export async function requireOnboarded(): Promise<{ user: UserResponse; accessToken: string }> {
  const current = await requireUser();
  if (current.user.onboardingStep !== 'complete') redirect(pathForStep(current.user.onboardingStep));
  return current;
}

/** For an onboarding step page: users elsewhere in the flow are sent to their actual step. */
export async function requireStep(step: OnboardingStep): Promise<{ user: UserResponse; accessToken: string }> {
  const current = await requireUser();
  if (current.user.onboardingStep !== step) redirect(pathForStep(current.user.onboardingStep));
  return current;
}
