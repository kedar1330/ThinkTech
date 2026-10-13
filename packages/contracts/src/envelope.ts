// Response envelope and codes shared by API and web (API.md §1.1, §4).

export const ERROR_CODES = [
  'INVALID_REQUEST',
  'UNAUTHENTICATED',
  'PASSWORD_INCORRECT',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PRODUCT_UNAVAILABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'AI_UNAVAILABLE',
  // Accounts and verification (API.md §3.1).
  'EMAIL_ALREADY_REGISTERED',
  'EMAIL_NOT_REGISTERED',
  'EMAIL_NOT_VERIFIED',
  'NOT_INVITED',
  'ACCOUNT_LOCKED',
  'OTP_INVALID',
  'OTP_LOCKED',
  'LINK_INVALID',
  'RESEND_COOLDOWN',
  'RESEND_LIMIT',
  'PASSWORD_SETUP_REQUIRED',
  'GOOGLE_ACCOUNT_EXISTS',
  'GOOGLE_NO_ACCOUNT',
  'PROVIDER_NOT_CONFIGURED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const WARNING_CODES = [
  'DEFAULTS_APPLIED',
  'PREFERENCE_CONFLICT',
  'INSUFFICIENT_MATCHES',
  'ALTERNATIVES_LIMITED',
  'AI_ENHANCEMENT_SKIPPED',
  'USER_ENTERED_PRICES',
] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  warnings?: WarningCode[];
}

export interface ErrorEnvelope {
  success: false;
  /** `retryAfterSeconds` accompanies lockouts, cooldowns and limits. */
  error: { code: ErrorCode; message: string; retryAfterSeconds?: number };
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
