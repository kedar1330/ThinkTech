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
  error: { code: ErrorCode; message: string };
}

export type Envelope<T> = SuccessEnvelope<T> | ErrorEnvelope;
