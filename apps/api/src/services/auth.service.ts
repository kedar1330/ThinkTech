import type { Logger } from 'pino';
import type { Connection, Types } from 'mongoose';
import {
  AUTH_MESSAGES,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetConfirmRequest,
  type UserResponse,
} from '@styleme/contracts';
import { ADMIN_RESET_TTL_MS, EMAIL_RESET_TTL_MS, type Config } from '../config/env';
import type { Models, UserDoc } from '../models/index';
import { randomToken, sha256 } from '../utils/crypto';
import { AppError } from '../utils/errors';
import { deleteAccount } from './account-deletion';
import type { EmailSender } from './email';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './passwords';
import { SessionService } from './sessions';

export type UserWithId = UserDoc & { _id: Types.ObjectId };

export function toUserResponse(user: UserWithId): UserResponse {
  return { id: String(user._id), email: user.email, name: user.name, role: user.role as UserResponse['role'] };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class AuthService {
  readonly sessions: SessionService;

  constructor(
    private readonly config: Config,
    private readonly models: Models,
    private readonly main: Connection,
    private readonly emailSender: EmailSender,
    private readonly logger: Logger,
  ) {
    this.sessions = new SessionService(models, config.AUTH_ACCESS_TOKEN_SECRET);
  }

  /** FR-AUTH-01, FR-AUTH-10. One generic refusal for "not invited" and "already registered". */
  async register(input: RegisterRequest): Promise<UserResponse> {
    const refused = new AppError('FORBIDDEN', AUTH_MESSAGES.registrationRefused);
    if (!this.config.PUBLIC_SIGNUP_ENABLED) {
      const invite = await this.models.BetaInvite.findOne({ email: input.email }).lean();
      if (!invite) throw refused;
    }
    if (await this.models.User.exists({ email: input.email })) throw refused;

    let user;
    try {
      user = await this.models.User.create({
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      });
    } catch (err) {
      if (isDuplicateKeyError(err)) throw refused;
      throw err;
    }
    await this.models.BetaInvite.updateOne({ email: input.email, usedAt: null }, { $set: { usedAt: new Date() } });
    return toUserResponse(user.toObject());
  }

  /** FR-AUTH-03. One generic error for unknown email, wrong password and inactive account. */
  async login(input: LoginRequest): Promise<string> {
    const failed = new AppError('UNAUTHENTICATED', AUTH_MESSAGES.loginFailed);
    const user = await this.models.User.findOne({ email: input.email }).lean();
    if (!user) {
      await verifyAgainstDummy(input.password);
      throw failed;
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok || !user.isActive) throw failed;
    return this.sessions.create(user._id, user.tokenVersion);
  }

  /** FR-AUTH-06: deletes only this session's record. */
  async logout(sid: string): Promise<void> {
    await this.sessions.revoke(sid);
  }

  /** FR-AUTH-11: revokes every session and token, then opens a new session for this browser. */
  async changePassword(user: UserWithId, input: ChangePasswordRequest): Promise<string> {
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new AppError('PASSWORD_INCORRECT', AUTH_MESSAGES.passwordIncorrect);
    }
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new AppError('UNAUTHENTICATED');
    await this.models.PasswordResetToken.deleteMany({ userId: user._id });
    await this.sessions.revokeAll(user._id);
    return this.sessions.create(updated._id, updated.tokenVersion);
  }

  /**
   * Issues a single-use reset token (D-83). Earlier unused tokens for the user are invalidated.
   * Returns the token; only its SHA-256 hash is stored. The token itself is never logged.
   */
  async issueResetToken(
    userId: Types.ObjectId,
    purpose: 'admin_issued' | 'self_service',
    issuedBy: Types.ObjectId | null = null,
  ): Promise<string> {
    await this.models.PasswordResetToken.deleteMany({ userId, usedAt: null });
    const token = randomToken();
    const now = Date.now();
    await this.models.PasswordResetToken.create({
      userId,
      tokenHash: sha256(token),
      purpose,
      issuedBy,
      createdAt: new Date(now),
      expiresAt: new Date(now + (purpose === 'admin_issued' ? ADMIN_RESET_TTL_MS : EMAIL_RESET_TTL_MS)),
    });
    this.logger.info({
      event: 'password_reset_token_issued',
      userId: String(userId),
      purpose,
      issuedBy: issuedBy ? String(issuedBy) : null,
    });
    return token;
  }

  /** FR-AUTH-13. Always the same response; an email only for an active account. */
  async requestPasswordReset(email: string): Promise<void> {
    if (!this.config.PASSWORD_RESET_EMAIL_ENABLED) {
      throw new AppError('FORBIDDEN', AUTH_MESSAGES.resetEmailDisabled);
    }
    const user = await this.models.User.findOne({ email, isActive: true }).lean();
    if (!user) return;
    const token = await this.issueResetToken(user._id, 'self_service');
    // The token goes in the URL fragment, which browsers never send to servers or in Referer headers.
    const link = `${this.config.WEB_ORIGIN}/reset-password#token=${token}`;
    // Not awaited, so the response time doesn't depend on whether the account exists.
    this.emailSender.sendPasswordReset(user.email, link).catch((err: unknown) => {
      this.logger.error({
        event: 'password_reset_email_failed',
        userId: String(user._id),
        reason: err instanceof Error ? err.message : 'unknown',
      });
    });
  }

  /** FR-AUTH-14. The token is marked used atomically, so only one concurrent redemption succeeds. */
  async confirmPasswordReset(input: ResetConfirmRequest): Promise<void> {
    const invalid = new AppError('INVALID_REQUEST', AUTH_MESSAGES.resetTokenInvalid);
    const now = new Date();
    const record = await this.models.PasswordResetToken.findOneAndUpdate(
      { tokenHash: sha256(input.token), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { returnDocument: 'after' },
    ).lean();
    if (!record) throw invalid;

    const user = await this.models.User.findOneAndUpdate(
      { _id: record.userId, isActive: true },
      {
        $set: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: now },
        $inc: { tokenVersion: 1 },
      },
    ).lean();
    if (!user) throw invalid;

    await this.models.PasswordResetToken.deleteMany({ userId: record.userId, _id: { $ne: record._id } });
    await this.sessions.revokeAll(record.userId);
    this.logger.info({ event: 'password_reset_completed', userId: String(record.userId), purpose: record.purpose });
  }

  /** FR-AUTH-09, D-85. */
  async deleteOwnAccount(user: UserWithId, password: string): Promise<void> {
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError('PASSWORD_INCORRECT', AUTH_MESSAGES.passwordIncorrect);
    }
    await deleteAccount(this.models, this.main, this.config.TOMBSTONE_HMAC_KEY, user, 'self_service');
    this.logger.info({ event: 'account_deleted', userId: String(user._id), source: 'self_service' });
  }
}
