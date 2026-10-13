import { AUTH_MESSAGES, type ErrorCode } from '@styleme/contracts';

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  PASSWORD_INCORRECT: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRODUCT_UNAVAILABLE: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  AI_UNAVAILABLE: 503,
  EMAIL_ALREADY_REGISTERED: 409,
  EMAIL_NOT_REGISTERED: 404,
  EMAIL_NOT_VERIFIED: 403,
  NOT_INVITED: 403,
  ACCOUNT_LOCKED: 423,
  OTP_INVALID: 400,
  OTP_LOCKED: 429,
  LINK_INVALID: 400,
  RESEND_COOLDOWN: 429,
  RESEND_LIMIT: 429,
  PASSWORD_SETUP_REQUIRED: 403,
  GOOGLE_ACCOUNT_EXISTS: 409,
  GOOGLE_NO_ACCOUNT: 404,
  PROVIDER_NOT_CONFIGURED: 503,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'Invalid request data',
  UNAUTHENTICATED: 'Authentication required',
  PASSWORD_INCORRECT: AUTH_MESSAGES.passwordIncorrect,
  FORBIDDEN: 'This action is not allowed',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflicting state',
  PRODUCT_UNAVAILABLE: 'Product unavailable',
  RATE_LIMITED: 'Too many requests — please try again later',
  INTERNAL_ERROR: 'Something went wrong',
  SERVICE_UNAVAILABLE: 'StyleMe is temporarily unavailable',
  AI_UNAVAILABLE: 'This feature is temporarily unavailable',
  EMAIL_ALREADY_REGISTERED: AUTH_MESSAGES.emailAlreadyRegistered,
  EMAIL_NOT_REGISTERED: AUTH_MESSAGES.emailNotRegistered,
  EMAIL_NOT_VERIFIED: AUTH_MESSAGES.emailNotVerified,
  NOT_INVITED: AUTH_MESSAGES.notInvited,
  ACCOUNT_LOCKED: AUTH_MESSAGES.accountLocked,
  OTP_INVALID: AUTH_MESSAGES.otpInvalid,
  OTP_LOCKED: AUTH_MESSAGES.otpLocked,
  LINK_INVALID: AUTH_MESSAGES.linkInvalid,
  RESEND_COOLDOWN: AUTH_MESSAGES.resendCooldown,
  RESEND_LIMIT: AUTH_MESSAGES.resendLimit,
  PASSWORD_SETUP_REQUIRED: AUTH_MESSAGES.passwordSetupRequired,
  GOOGLE_ACCOUNT_EXISTS: AUTH_MESSAGES.googleAccountExists,
  GOOGLE_NO_ACCOUNT: AUTH_MESSAGES.googleNoAccount,
  PROVIDER_NOT_CONFIGURED: 'This feature is not available yet.',
};

/** An expected error with a safe, user-facing message. Anything else becomes INTERNAL_ERROR. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    /** For lockouts, cooldowns and limits: seconds until the action may be retried. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.status = STATUS[code];
  }
}

export function secondsUntil(date: Date | null | undefined): number {
  return date ? Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000)) : 0;
}
