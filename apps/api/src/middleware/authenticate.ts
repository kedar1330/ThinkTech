import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import type { Models } from '../models/index';
import type { SessionService } from '../services/sessions';
import { AppError } from '../utils/errors';

/**
 * Protected routes (SECURITY.md §1): valid signature and expiry, the user exists and is active,
 * tokenVersion matches, and the session record exists. A JWT on its own is never enough. Sessions are
 * only ever issued to verified accounts (FR-AUTH-16).
 */
export function authenticate(models: Models, sessions: SessionService): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const claims = token ? sessions.verifyToken(token) : null;
    if (!claims || !Types.ObjectId.isValid(claims.sub)) throw new AppError('UNAUTHENTICATED');

    const user = await models.User.findById(claims.sub).lean();
    if (!user || !user.isActive || user.tokenVersion !== claims.tv || !user.emailVerifiedAt) {
      throw new AppError('UNAUTHENTICATED');
    }
    const session = await sessions.find(claims.sid, claims.sub);
    if (!session) throw new AppError('UNAUTHENTICATED');

    req.auth = { user, sid: claims.sid, remember: Boolean(session.remember) };
    next();
  };
}

/** Google sign-ups must create their StyleMe password before using the rest of the account (D-88). */
export const requirePasswordSet: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  if (!req.auth.user.passwordHash) throw new AppError('PASSWORD_SETUP_REQUIRED');
  next();
};
