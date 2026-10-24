import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { sendError } from '../utils/respond';

// IP and per-user rate limits (D-38, D-90). They sit in front of the account-level protections that
// live in the database (login lockout, code-attempt lockouts, resend cooldowns and hourly caps), so
// distributed guessing and request floods are slowed even before an account is touched.
// In-memory store: limits are per API instance and reset on restart, so they hold as stated only
// while one API instance runs (SECURITY.md §5). Each app instance gets fresh stores.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

export function limiter(windowMs: number, limit: number, key: (req: Request) => string): RateLimitRequestHandler {
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

export const byIp = (req: Request) => ipKeyGenerator(req.clientIp);
export const byUser = (req: Request) => `user:${req.auth ? String(req.auth.user._id) : ipKeyGenerator(req.clientIp)}`;

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

export interface AppRateLimits extends AuthRateLimits {
  recommendations: Limits;
  feedback: Limits;
  shortlistWrite: Limits;
  /** Photo uploads: each one is a paid Gemini analysis (D-129). */
  photoAnalysis: Limits;
  /** AI outfit image views: a first view is a paid generation, later ones read the stored image. */
  outfitImage?: Limits;
  /** Price ranges: an uncached garment is a paid Serper.dev search (#118). */
  priceRange?: Limits;
  /** New designs and picture retries: each one is a Gemini call and an image generation (D-134). */
  designStudio?: Limits;
  /** Style Assistant messages: each may be two Gemini calls and a feature run (D-136). */
  assistant?: Limits;
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

export function createRateLimits(): AppRateLimits {
  return {
    ...createAuthRateLimits(),
    recommendations: [limiter(MINUTE, 20, byUser)],
    feedback: [limiter(MINUTE, 60, byUser)],
    shortlistWrite: [limiter(MINUTE, 30, byUser)],
    photoAnalysis: [limiter(MINUTE, 5, byUser), limiter(HOUR, 20, byUser)],
    outfitImage: [limiter(MINUTE, 60, byUser), limiter(HOUR, 300, byUser)],
    priceRange: [limiter(MINUTE, 60, byUser), limiter(HOUR, 300, byUser)],
    designStudio: [limiter(MINUTE, 20, byUser), limiter(HOUR, 60, byUser)],
    assistant: [limiter(MINUTE, 10, byUser), limiter(HOUR, 120, byUser)],
  };
}
