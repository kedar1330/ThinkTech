import type { ErrorCode } from '@styleme/contracts';

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
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'Invalid request data',
  UNAUTHENTICATED: 'Authentication required',
  PASSWORD_INCORRECT: 'The password you entered is incorrect.',
  FORBIDDEN: 'This action is not allowed',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflicting state',
  PRODUCT_UNAVAILABLE: 'Product unavailable',
  RATE_LIMITED: 'Too many requests — please try again later',
  INTERNAL_ERROR: 'Something went wrong',
  SERVICE_UNAVAILABLE: 'StyleMe is temporarily unavailable',
  AI_UNAVAILABLE: 'This feature is temporarily unavailable',
};

/** An expected error with a safe, user-facing message. Anything else becomes INTERNAL_ERROR. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.status = STATUS[code];
  }
}
