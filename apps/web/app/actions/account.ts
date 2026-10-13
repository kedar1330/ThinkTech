'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  accountDetailsRequestSchema,
  changePasswordRequestSchema,
  emailChangeRequestSchema,
  otpSchema,
  phoneSetRequestSchema,
  tokenSchema,
  type OtpSentResponse,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { clearSession } from '@/lib/auth/session';
import {
  BLOCKED,
  bool,
  errorState,
  fieldErrors,
  redirectIfSignedOut,
  sameOrigin,
  startSession,
  str,
  tokenOrLogin,
  type FormState,
} from '@/lib/actions';

// Account settings (FR-AUTH-11, -17 … -19). Every action needs a session and a same-origin request.

function sent(res: OtpSentResponse, what: string): FormState {
  return {
    success: `We sent ${what} to ${res.destination}. It expires in 5 minutes.`,
    retryAfterSeconds: res.resendAvailableInSeconds,
    issuedAt: Date.now(),
    data: { sent: true, destination: res.destination },
  };
}

async function call<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const token = await tokenOrLogin();
  return apiRequest<T>(path, { method, body, token });
}

function failed(err: unknown): FormState {
  redirectIfSignedOut(err);
  return errorState(err);
}

// --- Details ----------------------------------------------------------------------------------------

export async function updateDetailsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = accountDetailsRequestSchema.safeParse({
    fullName: str(formData, 'fullName'),
    city: str(formData, 'city'),
    marketingOptIn: bool(formData, 'marketingOptIn'),
  });
  if (!parsed.success) return { error: 'Please check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  try {
    await call('/v1/account/details', 'PUT', parsed.data);
  } catch (err) {
    return failed(err);
  }
  revalidatePath('/settings');
  return { success: 'Your details have been saved.' };
}

// --- Password change by email code (D-93) --------------------------------------------------------------

export async function sendPasswordChangeCodeAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  try {
    return sent(await call<OtpSentResponse>('/v1/auth/password/change-otp', 'POST'), 'a 6-digit code');
  } catch (err) {
    return failed(err);
  }
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = changePasswordRequestSchema.safeParse({
    otp: str(formData, 'otp'),
    newPassword: str(formData, 'newPassword'),
    confirmPassword: str(formData, 'confirmPassword'),
  });
  if (!parsed.success) return { error: 'Please check the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  try {
    const { accessToken } = await call<{ accessToken: string }>('/v1/auth/password', 'PUT', parsed.data);
    // Every other session was revoked; this browser continues with a fresh session.
    await startSession(accessToken);
  } catch (err) {
    return failed(err);
  }
  return { success: 'Your password has been changed. You have been signed out on your other devices.' };
}

// --- Email change (FR-AUTH-17) --------------------------------------------------------------------------

export async function startEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = emailChangeRequestSchema.safeParse({
    password: str(formData, 'password'),
    newEmail: str(formData, 'newEmail'),
  });
  if (!parsed.success)
    return { error: 'Enter your current password and a valid new email.', fieldErrors: fieldErrors(parsed.error) };
  try {
    const res = await call<OtpSentResponse>('/v1/account/email-change', 'POST', parsed.data);
    revalidatePath('/settings');
    return sent(res, 'a code and a link');
  } catch (err) {
    return failed(err);
  }
}

export async function verifyEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const otp = otpSchema.safeParse(str(formData, 'otp'));
  if (!otp.success) return { error: 'Enter all 6 digits of the code.' };
  try {
    await call('/v1/account/email-change/verify', 'POST', { otp: otp.data });
  } catch (err) {
    return failed(err);
  }
  redirect('/settings?emailChanged=1');
}

/** From the emailed link; works without being signed in. */
export async function confirmEmailChangeLinkAction(token: string): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success)
    return { error: 'This link is incomplete. Copy the whole link from the email.', code: 'LINK_INVALID' };
  try {
    const res = await apiRequest<{ email: string }>('/v1/account/email-change/confirm', {
      method: 'POST',
      body: { token: parsed.data },
    });
    return { success: `Your email address is now ${res.email}.` };
  } catch (err) {
    return errorState(err);
  }
}

// --- Phone (D-92) -------------------------------------------------------------------------------------------

export async function startPhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const parsed = phoneSetRequestSchema.safeParse({ phone: str(formData, 'phone') });
  if (!parsed.success)
    return {
      error: 'Enter a valid Indian mobile number.',
      fieldErrors: { phone: 'Enter a valid Indian mobile number.' },
    };
  try {
    const res = await call<OtpSentResponse>('/v1/account/phone', 'PUT', parsed.data);
    revalidatePath('/settings');
    return sent(res, 'a 6-digit code by SMS');
  } catch (err) {
    const state = failed(err);
    return state?.code === 'PROVIDER_NOT_CONFIGURED'
      ? {
          ...state,
          error: 'Phone verification by SMS is not available yet. Your account works fully without a phone number.',
        }
      : state;
  }
}

export async function verifyPhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const otp = otpSchema.safeParse(str(formData, 'otp'));
  if (!otp.success) return { error: 'Enter all 6 digits of the code.' };
  try {
    await call('/v1/account/phone/verify', 'POST', { otp: otp.data });
  } catch (err) {
    return failed(err);
  }
  redirect('/settings?phoneVerified=1');
}

export async function removePhoneAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  try {
    await call('/v1/account/phone', 'DELETE');
  } catch (err) {
    return failed(err);
  }
  revalidatePath('/settings');
  return { success: 'Your phone number has been removed.' };
}

// --- Deletion (FR-AUTH-11, D-94) ------------------------------------------------------------------------------

export async function sendDeletionCodeAction(_prev: FormState): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  try {
    return sent(await call<OtpSentResponse>('/v1/account/deletion-otp', 'POST'), 'a 6-digit code');
  } catch (err) {
    return failed(err);
  }
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await sameOrigin())) return BLOCKED;
  const otp = otpSchema.safeParse(str(formData, 'otp'));
  if (!otp.success) return { error: 'Enter all 6 digits of the code.' };
  if (!bool(formData, 'confirm')) {
    return {
      error: 'Tick the box to confirm that you understand this cannot be undone.',
      fieldErrors: { confirm: 'Required' },
    };
  }
  try {
    await call('/v1/account', 'DELETE', { otp: otp.data, confirm: true });
  } catch (err) {
    return failed(err);
  }
  await clearSession();
  redirect('/?deleted=1');
}
