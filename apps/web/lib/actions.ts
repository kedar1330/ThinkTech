import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ZodError } from 'zod';
import { AUTH_MESSAGES, type ErrorCode } from '@styleme/contracts';
import { ApiError, decodeTokenClaims } from '@/lib/api/server';
import { cookieName, cookieOptions, type CookieKind } from '@/lib/auth/cookies';
import { clientIpFrom, isAllowedOrigin } from '@/lib/auth/origin';
import { getAccessToken, setSession } from '@/lib/auth/session';

// Helpers shared by the server actions. Every state-changing action checks the request Origin first
// (SECURITY.md §1). Error states carry only fixed, user-facing text: never tokens, codes or internals.

export type FormState =
  | {
      error?: string;
      success?: string;
      /** The API error code, so the form can offer the right next step (e.g. a Log in link). */
      code?: ErrorCode;
      fieldErrors?: Record<string, string>;
      retryAfterSeconds?: number;
      /** When the server produced this result; a key that restarts cooldown timers on each new result. */
      issuedAt?: number;
      /** Free-form result data for multi-step forms (e.g. "code sent to s•••@example.com"). */
      data?: Record<string, string | number | boolean>;
    }
  | undefined;

export const BLOCKED: FormState = { error: 'This request was blocked. Please reload the page and try again.' };
const UNAVAILABLE = 'Something went wrong on our side. Your entries are kept — please try again.';
const OFFLINE = 'We could not reach StyleMe. Check your connection; your entries are kept.';

export async function sameOrigin(): Promise<boolean> {
  return isAllowedOrigin((await headers()).get('origin'), process.env.AUTH_URL);
}

export async function clientIp(): Promise<string | undefined> {
  return clientIpFrom(await headers());
}

/** First message per field, keyed by the top-level field name. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message;
  }
  return out;
}

const MESSAGE: Partial<Record<ErrorCode, string>> = {
  EMAIL_ALREADY_REGISTERED: AUTH_MESSAGES.emailAlreadyRegistered,
  EMAIL_NOT_REGISTERED: AUTH_MESSAGES.emailNotRegistered,
  EMAIL_NOT_VERIFIED: AUTH_MESSAGES.emailNotVerified,
  REGISTRATION_PENDING: AUTH_MESSAGES.registrationPending,
  NOT_INVITED: AUTH_MESSAGES.notInvited,
  ACCOUNT_LOCKED: AUTH_MESSAGES.accountLocked,
  OTP_INVALID: AUTH_MESSAGES.otpInvalid,
  OTP_LOCKED: AUTH_MESSAGES.otpLocked,
  LINK_INVALID: AUTH_MESSAGES.linkInvalid,
  RESEND_COOLDOWN: AUTH_MESSAGES.resendCooldown,
  RESEND_LIMIT: AUTH_MESSAGES.resendLimit,
  PASSWORD_INCORRECT: AUTH_MESSAGES.passwordIncorrect,
  PASSWORD_SETUP_REQUIRED: AUTH_MESSAGES.passwordSetupRequired,
  UNAUTHENTICATED: AUTH_MESSAGES.loginFailed,
  RATE_LIMITED: 'Too many attempts. Please wait a minute and try again.',
  PROVIDER_NOT_CONFIGURED: 'This service is not available yet.',
  SERVICE_UNAVAILABLE: OFFLINE,
};

/** Converts an API failure into a form state. Validation messages from the API are safe to show. */
export function errorState(err: unknown, overrides: Partial<Record<ErrorCode, string>> = {}): FormState {
  if (!(err instanceof ApiError)) return { error: UNAVAILABLE };
  const message =
    overrides[err.code] ??
    (err.code === 'INVALID_REQUEST' || err.code === 'NOT_FOUND' || err.code === 'FORBIDDEN' || err.code === 'CONFLICT'
      ? err.message
      : MESSAGE[err.code]) ??
    UNAVAILABLE;
  return { error: message, code: err.code, retryAfterSeconds: err.retryAfterSeconds, issuedAt: Date.now() };
}

/** For signed-in actions: the access token, or straight to login. */
export async function tokenOrLogin(): Promise<string> {
  const token = await getAccessToken();
  if (!token) redirect('/login');
  return token;
}

/** A 401 from the API means the session ended (logout elsewhere, password change, expiry). */
export function redirectIfSignedOut(err: unknown): void {
  if (err instanceof ApiError && err.status === 401) redirect('/login?expired=1');
}

/** Stores a new API session; the cookie lifetime follows the session's Remember Me flag. */
export async function startSession(accessToken: string): Promise<void> {
  await setSession(accessToken, decodeTokenClaims(accessToken)?.rm ?? false);
}

export async function readCookie(kind: CookieKind): Promise<string | undefined> {
  return (await cookies()).get(cookieName(kind))?.value;
}

export async function writeCookie(kind: CookieKind, value: string, maxAge: number): Promise<void> {
  (await cookies()).set(cookieName(kind), value, cookieOptions(maxAge));
}

export async function deleteCookie(kind: CookieKind): Promise<void> {
  (await cookies()).delete(cookieName(kind));
}

export function bool(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === 'on' || v === 'true' || v === '1';
}

export function str(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}
