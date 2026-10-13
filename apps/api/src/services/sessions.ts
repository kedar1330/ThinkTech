import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { SESSION_TTL_DEFAULT_MS, SESSION_TTL_REMEMBER_MS } from '../config/env';
import type { Models, SessionDoc } from '../models/index';
import { randomToken, sha256 } from '../utils/crypto';

// Server-side sessions (D-07, D-91, SECURITY.md §1). The JWT carries the user ID, tokenVersion and a
// random session ID; the session record is checked on every request, so a JWT alone is never enough.
// Remember Me: 30 days. Otherwise the web app uses a browser-session cookie and the server stops
// accepting the session after 24 hours. Lifetimes are absolute, never extended by activity.

export interface AccessTokenClaims {
  sub: string;
  tv: number;
  sid: string;
}

export class SessionService {
  constructor(
    private readonly models: Models,
    private readonly secret: string,
  ) {}

  /** Creates a session record and returns an access token bound to it. Both expire together. */
  async create(userId: Types.ObjectId | string, tokenVersion: number, remember = false): Promise<string> {
    const sid = randomToken();
    const now = Date.now();
    const expiresAt = new Date(now + (remember ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_DEFAULT_MS));
    await this.models.Session.create({ sidHash: sha256(sid), userId, remember, createdAt: new Date(now), expiresAt });
    const claims: AccessTokenClaims = { sub: String(userId), tv: tokenVersion, sid };
    return jwt.sign({ ...claims, rm: remember, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
      algorithm: 'HS256',
    });
  }

  /** Returns the claims if the signature and expiry are valid; null otherwise. */
  verifyToken(token: string): AccessTokenClaims | null {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      if (typeof payload !== 'object' || payload === null) return null;
      const { sub, tv, sid } = payload as Record<string, unknown>;
      if (typeof sub !== 'string' || typeof tv !== 'number' || typeof sid !== 'string') return null;
      return { sub, tv, sid };
    } catch {
      return null;
    }
  }

  /** The live session record, or null if it was revoked or has expired (TTL deletion can lag). */
  async find(sid: string, userId: string): Promise<SessionDoc | null> {
    const session = await this.models.Session.findOne({ sidHash: sha256(sid), userId }).lean();
    return session && session.expiresAt.getTime() > Date.now() ? session : null;
  }

  async isLive(sid: string, userId: string): Promise<boolean> {
    return (await this.find(sid, userId)) !== null;
  }

  async revoke(sid: string): Promise<void> {
    await this.models.Session.deleteOne({ sidHash: sha256(sid) });
  }

  async revokeAll(userId: Types.ObjectId | string): Promise<void> {
    await this.models.Session.deleteMany({ userId });
  }
}
