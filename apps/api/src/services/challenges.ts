import { randomInt } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  MAX_SENDS_PER_HOUR,
  OTP_LOCKOUT_MS,
  OTP_MAX_FAILED_ATTEMPTS,
  OTP_TTL_MS,
  PENDING_REGISTRATION_TTL_MS,
  RESEND_COOLDOWN_MS,
} from '../config/env';
import type { AuthChallengeDoc, ChallengePurpose, Models } from '../models/index';
import { hmacSha256, randomToken, safeEqual, sha256 } from '../utils/crypto';
import { AppError, secondsUntil } from '../utils/errors';

// One-time codes and links for every account flow (D-89, DATABASE.md §3.1b). All limits are enforced
// here, on the server: expiry, single use, 3 wrong codes → 30-minute lockout, 30-second resend cooldown,
// and at most 6 sends (first + 5 resends) per rolling hour. Codes are 6 random digits stored as keyed
// hashes; link tokens are 256-bit random values stored as SHA-256 hashes.

const HOUR_MS = 60 * 60 * 1000;

export type Challenge = AuthChallengeDoc & { _id: Types.ObjectId };

/** Send timestamps in the rolling window (Mongoose types array elements loosely). */
function sends(challenge: Challenge | null | undefined): Date[] {
  return ((challenge?.sentAt ?? []) as unknown as Date[]).map((d) => new Date(d));
}

export interface IssueOptions {
  otp?: boolean;
  /** Link lifetime in ms; omit for code-only challenges. */
  linkTtlMs?: number;
  target?: string | null;
  pendingTokenHash?: string | null;
  rememberMe?: boolean;
  issuedBy?: Types.ObjectId | null;
  /** Skip the cooldown and hourly limit (e.g. the first email at registration or an admin code). */
  bypassLimits?: boolean;
}

export interface Issued {
  otp?: string;
  linkToken?: string;
}

export class ChallengeService {
  constructor(
    private readonly models: Models,
    private readonly secret: string,
  ) {}

  private otpHash(challengeKey: string, otp: string): string {
    return hmacSha256(this.secret, `otp:${challengeKey}:${otp}`);
  }

  async find(userId: Types.ObjectId, purpose: ChallengePurpose): Promise<Challenge | null> {
    return this.models.AuthChallenge.findOne({ userId, purpose }).lean();
  }

  /** Seconds until another send is allowed (0 when allowed now). */
  resendWaitSeconds(challenge: Challenge | null): number {
    if (!challenge) return 0;
    const now = Date.now();
    const recent = sends(challenge).filter((d) => now - d.getTime() < HOUR_MS);
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      const oldest = Math.min(...recent.map((d) => d.getTime()));
      return secondsUntil(new Date(oldest + HOUR_MS));
    }
    const last = recent.length ? Math.max(...recent.map((d) => d.getTime())) : 0;
    return last && now - last < RESEND_COOLDOWN_MS ? secondsUntil(new Date(last + RESEND_COOLDOWN_MS)) : 0;
  }

  /**
   * Issues a fresh code and/or link, replacing (and so invalidating) any earlier one for the same user
   * and purpose. Lockouts and send history carry over. Throws RESEND_COOLDOWN or RESEND_LIMIT.
   */
  async issue(userId: Types.ObjectId, purpose: ChallengePurpose, options: IssueOptions): Promise<Issued> {
    const existing = await this.find(userId, purpose);
    if (!options.bypassLimits && existing) {
      const now = Date.now();
      const recent = sends(existing).filter((d) => now - d.getTime() < HOUR_MS);
      const wait = this.resendWaitSeconds(existing);
      if (wait > 0) {
        throw recent.length >= MAX_SENDS_PER_HOUR
          ? new AppError('RESEND_LIMIT', undefined, wait)
          : new AppError('RESEND_COOLDOWN', undefined, wait);
      }
    }

    const now = new Date();
    const key = `${String(userId)}:${purpose}`;
    const otp = options.otp ? String(randomInt(0, 1_000_000)).padStart(6, '0') : undefined;
    const linkToken = options.linkTtlMs ? randomToken() : undefined;
    const sentAt = [...sends(existing).filter((d) => now.getTime() - d.getTime() < HOUR_MS), now];
    const lockedUntil = existing?.lockedUntil && existing.lockedUntil > now ? existing.lockedUntil : null;

    await this.models.AuthChallenge.updateOne(
      { userId, purpose },
      {
        $set: {
          target: options.target ?? existing?.target ?? null,
          otpHash: otp ? this.otpHash(key, otp) : null,
          otpExpiresAt: otp ? new Date(now.getTime() + OTP_TTL_MS) : null,
          linkHash: linkToken ? sha256(linkToken) : null,
          linkExpiresAt: linkToken && options.linkTtlMs ? new Date(now.getTime() + options.linkTtlMs) : null,
          consumedAt: null,
          // Wrong attempts carry over a resend, so resending can't be used to reset the 3-attempt limit.
          failedAttempts: existing?.failedAttempts ?? 0,
          lockedUntil,
          sentAt,
          pendingTokenHash:
            options.pendingTokenHash !== undefined ? options.pendingTokenHash : (existing?.pendingTokenHash ?? null),
          rememberMe: options.rememberMe ?? existing?.rememberMe ?? false,
          issuedBy: options.issuedBy ?? null,
          expiresAt: new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS),
        },
      },
      { upsert: true },
    );
    return { otp, linkToken };
  }

  /**
   * Checks a code. A correct, unexpired, unused code is consumed atomically (only one concurrent request
   * can succeed). Wrong codes count towards the lockout. Throws OTP_LOCKED or OTP_INVALID.
   */
  async verifyOtp(userId: Types.ObjectId, purpose: ChallengePurpose, otp: string): Promise<Challenge> {
    const challenge = await this.find(userId, purpose);
    const now = new Date();
    if (challenge?.lockedUntil && challenge.lockedUntil > now) {
      throw new AppError('OTP_LOCKED', undefined, secondsUntil(challenge.lockedUntil));
    }
    const valid =
      challenge?.otpHash &&
      challenge.otpExpiresAt &&
      challenge.otpExpiresAt > now &&
      !challenge.consumedAt &&
      safeEqual(challenge.otpHash, this.otpHash(`${String(userId)}:${purpose}`, otp));

    if (!valid) {
      if (challenge) await this.recordFailure(challenge);
      throw new AppError('OTP_INVALID');
    }

    const consumed = await this.models.AuthChallenge.findOneAndUpdate(
      { _id: challenge._id, consumedAt: null, otpHash: challenge.otpHash },
      { $set: { consumedAt: now, failedAttempts: 0 } },
      { returnDocument: 'after' },
    ).lean();
    if (!consumed) throw new AppError('OTP_INVALID');
    return consumed;
  }

  private async recordFailure(challenge: Challenge): Promise<void> {
    const updated = await this.models.AuthChallenge.findOneAndUpdate(
      { _id: challenge._id },
      { $inc: { failedAttempts: 1 } },
      { returnDocument: 'after' },
    ).lean();
    if (updated && updated.failedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + OTP_LOCKOUT_MS);
      await this.models.AuthChallenge.updateOne(
        { _id: challenge._id },
        { $set: { lockedUntil, failedAttempts: 0, otpHash: null, otpExpiresAt: null } },
      );
      throw new AppError('OTP_LOCKED', undefined, secondsUntil(lockedUntil));
    }
  }

  /** Consumes a link token atomically: valid only if unused and unexpired. Throws LINK_INVALID. */
  async consumeLink(purposes: readonly ChallengePurpose[], token: string): Promise<Challenge> {
    const now = new Date();
    const consumed = await this.models.AuthChallenge.findOneAndUpdate(
      { linkHash: sha256(token), purpose: { $in: purposes }, consumedAt: null, linkExpiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: 'after' },
    ).lean();
    if (!consumed) throw new AppError('LINK_INVALID');
    return consumed;
  }

  /** Finds the pending registration that a pending-registration token belongs to. */
  async findByPendingToken(pendingToken: string): Promise<Challenge | null> {
    return this.models.AuthChallenge.findOne({
      purpose: 'email_verification',
      pendingTokenHash: sha256(pendingToken),
    }).lean();
  }

  async clear(userId: Types.ObjectId, purpose: ChallengePurpose): Promise<void> {
    await this.models.AuthChallenge.deleteOne({ userId, purpose });
  }

  async clearAll(userId: Types.ObjectId): Promise<void> {
    await this.models.AuthChallenge.deleteMany({ userId });
  }
}
