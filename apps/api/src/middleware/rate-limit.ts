import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { sendError } from '../utils/respond';

// IP and per-user rate limits (D-38, D-90). They sit in front of the account-level protections that
// live in the database (login lockout, code-attempt lockouts, resend cooldowns and hourly caps), so
// distributed guessing and request floods are slowed even before an account is touched.
// In-memory store: limits are per API instance and reset on restart, so they hold as stated only
// while one API instance runs (SECURITY.md §5). Each app instance gets fresh stores.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function limiter(windowMs: number, limit: number, key: (req: Request) => string): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key,
    handler: (_req, res) =>
      sendError(res, 429, 'RATE_LIMITED', 'Too many requests — please try again later', Math.ceil(windowMs / 1000)),
  });
}

const byIp = (req: Request) => ipKeyGenerator(req.clientIp);
const byUser = (req: Request) => `user:${req.auth ? String(req.auth.user._id) : ipKeyGenerator(req.clientIp)}`;

export type Limits = RateLimitRequestHandler[];

export interface AuthRateLimits {
  login: Limits;
  register: Limits;
  google: Limits;
  logout: Limits;
  /** Checking any one-time code (email verification, password reset). */
  codeCheck: Limits;
  /** Anything that sends an email or SMS without a session (resend, reset request). */
  codeSend: Limits;
  resetConfirm: Limits;
  /** Signed-in security actions: password change, email change, phone, deletion codes. */
  accountSecurity: Limits;
  deleteAccount: Limits;
}

export function createAuthRateLimits(): AuthRateLimits {
  return {
    login: [limiter(MINUTE, 5, byIp), limiter(HOUR, 30, byIp)],
    register: [limiter(MINUTE, 3, byIp), limiter(HOUR, 20, byIp)],
    google: [limiter(MINUTE, 10, byIp)],
    logout: [limiter(MINUTE, 30, byUser)],
    codeCheck: [limiter(MINUTE, 10, byIp), limiter(HOUR, 30, byIp)],
    codeSend: [limiter(MINUTE, 10, byIp), limiter(HOUR, 30, byIp)],
    resetConfirm: [limiter(HOUR, 10, byIp)],
    accountSecurity: [limiter(HOUR, 30, byUser)],
    deleteAccount: [limiter(HOUR, 5, byUser)],
  };
}
