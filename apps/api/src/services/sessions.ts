import jwt from 'jsonwebtoken';
import type { Types } from 'mongoose';
import { SESSION_TTL_MS } from '../config/env';
import type { Models } from '../models/index';
import { randomToken, sha256 } from '../utils/crypto';

// Server-side sessions (D-07, SECURITY.md §1). The JWT carries the user ID, tokenVersion and a
// random session ID; the session record is checked on every request, so a JWT alone is never enough.

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
  async create(userId: Types.ObjectId | string, tokenVersion: number): Promise<string> {
    const sid = randomToken();
    const now = Date.now();
    const expiresAt = new Date(now + SESSION_TTL_MS);
    await this.models.Session.create({ sidHash: sha256(sid), userId, createdAt: new Date(now), expiresAt });
    const claims: AccessTokenClaims = { sub: String(userId), tv: tokenVersion, sid };
    return jwt.sign({ ...claims, exp: Math.floor(expiresAt.getTime() / 1000) }, this.secret, {
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

  /** True if the session record exists and hasn't expired (TTL deletion can lag up to a minute). */
  async isLive(sid: string, userId: string): Promise<boolean> {
    const session = await this.models.Session.findOne({ sidHash: sha256(sid), userId }).lean();
    return session !== null && session.expiresAt.getTime() > Date.now();
  }

  async revoke(sid: string): Promise<void> {
    await this.models.Session.deleteOne({ sidHash: sha256(sid) });
  }

  async revokeAll(userId: Types.ObjectId | string): Promise<void> {
    await this.models.Session.deleteMany({ userId });
  }
}
