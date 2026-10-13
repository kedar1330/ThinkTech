'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  emailSchema,
  loginRequestSchema,
  otpSchema,
  registerRequestSchema,
  resetConfirmRequestSchema,
  resetRequestRequestSchema,
  tokenSchema,
  type PendingVerificationResponse,
  type RegisterResponse,
  type SessionResponse,
  type VerifyEmailResponse,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { PENDING_MAX_AGE_SECONDS, RESET_MAX_AGE_SECONDS } from '@/lib/auth/cookies';
import { clearSession, getAccessToken, pathForStep } from '@/lib/auth/session';
import {
  BLOCKED,
  bool,
  clientIp,
  deleteCookie,
  errorState,
  fieldErrors,
  readCookie,
  sameOrigin,
  startSession,
  str,
  writeCookie,
  type FormState,
} from '@/lib/actions';

// Public authentication flows (FR-AUTH-01, -03, -13, -16). Tokens that prove "this browser started
// the flow" (pending registration, reset) live only in HttpOnly cookies, never in the page.

export type { FormState };

// --- Registration ----------------------------------------------------------------------------------

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const phone = str(formData, 'phone').trim();
  const parsed = registerRequestSchema.safeParse({
    fullName: str(formData, 'fullName'),
    email: str(formData, 'email'),
    password: str(formData, 'password'),
    confirmPassword: str(formData, 'confirmPassword'),
    city: str(formData, 'city'),
    phone: phone || undefined,
    acceptTerms: bool(formData, 'acceptTerms'),
    marketingOptIn: bool(formData, 'marketingOptIn'),
    rememberMe: bool(formData, 'rememberMe'),
  });
  if (!parsed.success) {
    return { error: 'Please check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  }
  let result: RegisterResponse;
  try {
    result = await apiRequest<RegisterResponse>('/v1/auth/register', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    const state = errorState(err);
    return state?.code === 'EMAIL_ALREADY_REGISTERED'
      ? { ...state, fieldErrors: { email: 'This email already has an account.' } }
      : state;
  }
  await writeCookie('pending', result.pendingToken, PENDING_MAX_AGE_SECONDS);
  await deleteCookie('pendingEmail');
  redirect(result.verificationEmailSent ? '/verify-email' : '/verify-email?sendFailed=1');
}

// --- Email verification ------------------------------------------------------------------------------

/** The registering browser's pending state, or the email entered on the recovery screen. */
async function pendingContext(): Promise<{ pendingToken?: string; email?: string }> {
  return { pendingToken: await readCookie('pending'), email: await readCookie('pendingEmail') };
}

/** The email of this browser's pending registration, or undefined when that session has ended. */
async function pendingEmailFor(pendingToken: string | undefined): Promise<string | undefined> {
  if (!pendingToken) return undefined;
  try {
    const res = await apiRequest<PendingVerificationResponse>('/v1/auth/email-verification/pending', {
      method: 'POST',
      body: { pendingToken },
    });
    return res.email;
  } catch {
    return undefined;
  }
}

async function finishVerification(result: VerifyEmailResponse): Promise<never> {
  await deleteCookie('pending');
  await deleteCookie('pendingEmail');
  if (result.accessToken) {
    await startSession(result.accessToken);
    redirect('/verify-email/success');
  }
  // Verified from another device or after recovery: no session here; log in to continue.
  redirect('/verify-email/success?login=1');
}

export async function verifyEmailOtpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const otp = otpSchema.safeParse(str(formData, 'otp'));
  if (!otp.success) return { error: 'Enter all 6 digits of the code.' };
  const { pendingToken, email: recoveryEmail } = await pendingContext();
  // The pending session may have ended; fall back to the recovery email if there is one.
  const email = (await pendingEmailFor(pendingToken)) ?? recoveryEmail;
  if (!email) redirect('/verify-email/required');
  let result: VerifyEmailResponse;
  try {
    result = await apiRequest<VerifyEmailResponse>('/v1/auth/email-verification/otp', {
      method: 'POST',
      body: { email, otp: otp.data, ...(pendingToken ? { pendingToken } : {}) },
      clientIp: await clientIp(),
    });
  } catch (err) {
    return errorState(err);
  }
  return finishVerification(result);
}

export async function verifyEmailLinkAction(token: string): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success)
    return { error: 'This link is incomplete. Copy the whole link from the email.', code: 'LINK_INVALID' };
  const { pendingToken } = await pendingContext();
  let result: VerifyEmailResponse;
  try {
    result = await apiRequest<VerifyEmailResponse>('/v1/auth/email-verification/link', {
      method: 'POST',
      body: { token: parsed.data, ...(pendingToken ? { pendingToken } : {}) },
      clientIp: await clientIp(),
    });
  } catch (err) {
    return errorState(err);
  }
  return finishVerification(result);
}

export async function resendVerificationAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const { pendingToken, email: recoveryEmail } = await pendingContext();
  const pendingEmail = await pendingEmailFor(pendingToken);
  const email = pendingEmail ?? recoveryEmail;
  if (!email) redirect('/verify-email/required');
  try {
    const res = await apiRequest<{ accepted: true; resendAvailableInSeconds?: number }>(
      '/v1/auth/email-verification/resend',
      {
        method: 'POST',
        body: pendingEmail ? { email, pendingToken } : { email },
        clientIp: await clientIp(),
      },
    );
    return {
      success: 'A new code and link are on their way. Earlier codes no longer work.',
      retryAfterSeconds: res.resendAvailableInSeconds ?? 30,
      issuedAt: Date.now(),
    };
  } catch (err) {
    return errorState(err);
  }
}

export async function changePendingEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const pendingToken = await readCookie('pending');
  if (!pendingToken) redirect('/verify-email/required');
  const email = emailSchema.safeParse(str(formData, 'newEmail'));
  if (!email.success)
    return { error: 'Enter a valid email address.', fieldErrors: { newEmail: 'Enter a valid email address.' } };
  try {
    const res = await apiRequest<{ email: string; verificationEmailSent: boolean }>(
      '/v1/auth/email-verification/email',
      {
        method: 'PUT',
        body: { pendingToken, newEmail: email.data },
        clientIp: await clientIp(),
      },
    );
    // The verification page re-renders with the corrected address.
    revalidatePath('/verify-email');
    return {
      success: res.verificationEmailSent
        ? `We sent a new code and link to ${res.email}.`
        : `Your email is now ${res.email}, but we could not send the code. Use "Resend code".`,
      data: { email: res.email },
      retryAfterSeconds: 30,
      issuedAt: Date.now(),
    };
  } catch (err) {
    return errorState(err);
  }
}

/** Recovery (FR-AUTH-16): verification by email alone. The response is the same for any email. */
export async function requestVerificationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const email = emailSchema.safeParse(str(formData, 'email'));
  if (!email.success)
    return { error: 'Enter a valid email address.', fieldErrors: { email: 'Enter a valid email address.' } };
  try {
    await apiRequest('/v1/auth/email-verification/resend', {
      method: 'POST',
      body: { email: email.data },
      clientIp: await clientIp(),
    });
  } catch (err) {
    return errorState(err);
  }
  await deleteCookie('pending');
  await writeCookie('pendingEmail', email.data, PENDING_MAX_AGE_SECONDS);
  redirect('/verify-email?recovery=1');
}

// --- Login and logout ---------------------------------------------------------------------------------

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = loginRequestSchema.safeParse({
    email: str(formData, 'email'),
    password: str(formData, 'password'),
    rememberMe: bool(formData, 'rememberMe'),
  });
  if (!parsed.success) return { error: 'Enter your email and password.', fieldErrors: fieldErrors(parsed.error) };
  let session: SessionResponse;
  try {
    session = await apiRequest<SessionResponse>('/v1/auth/login', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    const state = errorState(err);
    if (state?.code === 'EMAIL_NOT_VERIFIED') {
      // Spec §7/§8: show the verification-required screen. The email is kept in an HttpOnly cookie so
      // that screen can send a new code with one click. No session is created.
      await writeCookie('pendingEmail', parsed.data.email, PENDING_MAX_AGE_SECONDS);
      redirect('/verify-email/required?from=login');
    }
    return state;
  }
  await startSession(session.accessToken);
  redirect(pathForStep(session.onboardingStep));
}

/** Ends this browser's session only (D-91); other devices stay signed in. */
export async function logoutAction(): Promise<void> {
  if (!(await sameOrigin())) return;
  const token = await getAccessToken();
  if (token) {
    await apiRequest('/v1/auth/logout', { method: 'POST', token }).catch(() => undefined);
  }
  await clearSession();
  redirect('/login?loggedOut=1');
}

// --- Password reset (FR-AUTH-13) ---------------------------------------------------------------------------

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = resetRequestRequestSchema.safeParse({
    email: str(formData, 'email'),
    method: str(formData, 'method') === 'otp' ? 'otp' : 'link',
  });
  if (!parsed.success)
    return { error: 'Enter a valid email address.', fieldErrors: { email: 'Enter a valid email address.' } };
  try {
    await apiRequest('/v1/auth/password-reset/request', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    return errorState(err);
  }
  if (parsed.data.method === 'otp') {
    await writeCookie('reset', JSON.stringify({ email: parsed.data.email }), RESET_MAX_AGE_SECONDS);
    redirect('/forgot-password/code');
  }
  return {
    success: 'We sent a reset link. It works once and expires in 15 minutes.',
    data: { email: parsed.data.email },
    retryAfterSeconds: 30,
    issuedAt: Date.now(),
  };
}

async function readResetCookie(): Promise<{ email?: string; resetToken?: string }> {
  try {
    return JSON.parse((await readCookie('reset')) ?? '{}') as { email?: string; resetToken?: string };
  } catch {
    return {};
  }
}

export async function resendResetCodeAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const { email } = await readResetCookie();
  if (!email) redirect('/forgot-password');
  try {
    await apiRequest('/v1/auth/password-reset/request', {
      method: 'POST',
      body: { email, method: 'otp' },
      clientIp: await clientIp(),
    });
    return {
      success: 'A new code is on its way. Earlier codes no longer work.',
      retryAfterSeconds: 30,
      issuedAt: Date.now(),
    };
  } catch (err) {
    return errorState(err);
  }
}

export async function verifyResetCodeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const otp = otpSchema.safeParse(str(formData, 'otp'));
  if (!otp.success) return { error: 'Enter all 6 digits of the code.' };
  const { email } = await readResetCookie();
  if (!email) redirect('/forgot-password');
  let resetToken: string;
  try {
    ({ resetToken } = await apiRequest<{ resetToken: string }>('/v1/auth/password-reset/verify-otp', {
      method: 'POST',
      body: { email, otp: otp.data },
      clientIp: await clientIp(),
    }));
  } catch (err) {
    return errorState(err);
  }
  await writeCookie('reset', JSON.stringify({ resetToken }), RESET_MAX_AGE_SECONDS);
  redirect('/reset-password');
}

/** The token comes from the link's URL fragment (sent by the page) or the code step's cookie. */
export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const token = str(formData, 'token') || (await readResetCookie()).resetToken || '';
  const parsed = resetConfirmRequestSchema.safeParse({
    token,
    newPassword: str(formData, 'newPassword'),
    confirmPassword: str(formData, 'confirmPassword'),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.token) return { error: 'This reset link or code is invalid or has expired.', code: 'LINK_INVALID' };
    return { error: 'Please check the highlighted fields.', fieldErrors: errors };
  }
  try {
    await apiRequest('/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: parsed.data,
      clientIp: await clientIp(),
    });
  } catch (err) {
    return errorState(err, { LINK_INVALID: 'This reset link or code is invalid, has expired or was already used.' });
  }
  await deleteCookie('reset');
  // All sessions were revoked by the API, including this browser's; no automatic login (D-89).
  await clearSession();
  redirect('/login?reset=1');
}
