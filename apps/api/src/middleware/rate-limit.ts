import type { Request } from 'express';
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import { normaliseEmail } from '../utils/crypto';
import { sendError } from '../utils/respond';

// Rate limits (D-38). In-memory store: limits are per API instance and reset on restart, so they hold
// as stated only while one API instance runs (SECURITY.md §5). Each app instance gets fresh stores.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function limiter(windowMs: number, limit: number, key: (req: Request) => string): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: key,
    handler: (_req, res) => sendError(res, 429, 'RATE_LIMITED', 'Too many requests — please try again later'),
  });
}

const byIp = (req: Request) => ipKeyGenerator(req.clientIp);
const byUser = (req: Request) => `user:${req.auth ? String(req.auth.user._id) : ipKeyGenerator(req.clientIp)}`;
const byEmail = (req: Request) => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? `email:${normaliseEmail(email)}` : `ip:${ipKeyGenerator(req.clientIp)}`;
};

export interface AuthRateLimits {
  login: RateLimitRequestHandler;
  register: RateLimitRequestHandler;
  logout: RateLimitRequestHandler;
  deleteAccount: RateLimitRequestHandler;
  changePassword: RateLimitRequestHandler;
  resetConfirm: RateLimitRequestHandler;
  resetRequestByEmail: RateLimitRequestHandler;
  resetRequestByIp: RateLimitRequestHandler;
}

export function createAuthRateLimits(): AuthRateLimits {
  return {
    login: limiter(MINUTE, 5, byIp),
    register: limiter(MINUTE, 3, byIp),
    logout: limiter(MINUTE, 30, byUser),
    deleteAccount: limiter(HOUR, 3, byUser),
    changePassword: limiter(HOUR, 5, byUser),
    resetConfirm: limiter(HOUR, 10, byIp),
    resetRequestByEmail: limiter(HOUR, 3, byEmail),
    resetRequestByIp: limiter(HOUR, 10, byIp),
  };
}
