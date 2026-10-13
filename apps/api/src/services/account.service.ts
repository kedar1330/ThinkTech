import type { Logger } from 'pino';
import type { Types } from 'mongoose';
import type {
  AccountDetailsRequest,
  EmailChangeRequest,
  OtpSentResponse,
  PhoneSetRequest,
  UserResponse,
} from '@styleme/contracts';
import { EMAIL_CHANGE_LINK_TTL_MS, type Config } from '../config/env';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';
import { deleteAccount } from './account-deletion';
import { type AuthService, type UserWithId, toUserResponse } from './auth.service';
import type { SmsSender } from './messaging';
import { verifyPassword } from './passwords';
import { link, maskEmail, maskPhone, templates } from './templates';

// Account settings (FR-AUTH-09, -17, -18, -19): details, email change, optional phone verification and
// account deletion. Every method acts only on the authenticated user passed in.

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class AccountService {
  constructor(
    private readonly config: Config,
    private readonly models: Models,
    private readonly auth: AuthService,
    private readonly sms: SmsSender | null,
    private readonly logger: Logger,
  ) {}

  /** The current user plus any email or phone change still waiting for verification. */
  async me(user: UserWithId): Promise<UserResponse> {
    const now = new Date();
    const [emailChange, phone] = await Promise.all([
      this.auth.challenges.find(user._id, 'email_change'),
      this.auth.challenges.find(user._id, 'phone_verification'),
    ]);
    const pending = (c: typeof emailChange) =>
      c && !c.consumedAt && ((c.otpExpiresAt && c.otpExpiresAt > now) || (c.linkExpiresAt && c.linkExpiresAt > now))
        ? c.target
        : null;
    return toUserResponse(user, { email: pending(emailChange), phone: pending(phone) });
  }

  async updateDetails(user: UserWithId, input: AccountDetailsRequest): Promise<UserResponse> {
    const set: Record<string, unknown> = {};
    if (input.fullName !== undefined) set.name = input.fullName;
    if (input.city !== undefined) set.city = input.city;
    if (input.marketingOptIn !== undefined) {
      set['consent.marketingOptIn'] = input.marketingOptIn;
      set['consent.marketingUpdatedAt'] = new Date();
    }
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      { $set: set },
      { returnDocument: 'after' },
    ).lean();
    return this.me(updated!);
  }

  // --- Email change: re-authenticate, verify the new address, keep the old one until then ------------

  async startEmailChange(user: UserWithId, input: EmailChangeRequest): Promise<OtpSentResponse> {
    if (!user.passwordHash) throw new AppError('PASSWORD_SETUP_REQUIRED');
    if (!(await verifyPassword(user.passwordHash, input.password))) throw new AppError('PASSWORD_INCORRECT');
    if (input.newEmail === user.email) throw new AppError('INVALID_REQUEST', 'This is already your email address.');
    if (await this.models.User.exists({ email: input.newEmail }))
      throw new AppError('EMAIL_ALREADY_REGISTERED', 'That email address is already used by another account.');

    const { otp, linkToken } = await this.auth.challenges.issue(user._id, 'email_change', {
      otp: true,
      linkTtlMs: EMAIL_CHANGE_LINK_TTL_MS,
      target: input.newEmail,
    });
    const confirmLink = link(this.config.WEB_ORIGIN, '/settings/email/confirm', linkToken!);
    await this.auth.deliver(
      templates.emailChangeVerify(input.newEmail, otp!, confirmLink),
      'email_change_email',
      user._id,
    );
    const challenge = await this.auth.challenges.find(user._id, 'email_change');
    return {
      sent: true,
      destination: maskEmail(input.newEmail),
      resendAvailableInSeconds: this.auth.challenges.resendWaitSeconds(challenge),
    };
  }

  async verifyEmailChangeOtp(user: UserWithId, otp: string): Promise<UserResponse> {
    const challenge = await this.auth.challenges.verifyOtp(user._id, 'email_change', otp);
    return this.applyEmailChange(challenge.userId, challenge.target);
  }

  async confirmEmailChangeLink(token: string): Promise<{ email: string }> {
    const challenge = await this.auth.challenges.consumeLink(['email_change'], token);
    const updated = await this.applyEmailChange(challenge.userId, challenge.target);
    return { email: updated.email };
  }

  /** Atomically switches the email; the unique index rejects a race with another registration. */
  private async applyEmailChange(userId: Types.ObjectId, target: string | null | undefined): Promise<UserResponse> {
    if (!target) throw new AppError('LINK_INVALID');
    const before = await this.models.User.findById(userId).lean();
    if (!before || !before.isActive) throw new AppError('LINK_INVALID');
    let updated: UserWithId | null;
    try {
      updated = await this.models.User.findOneAndUpdate(
        { _id: userId, email: before.email },
        { $set: { email: target, emailVerifiedAt: new Date() } },
        { returnDocument: 'after' },
      ).lean();
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw new AppError('EMAIL_ALREADY_REGISTERED', 'That email address is already used by another account.');
      throw err;
    }
    if (!updated) throw new AppError('CONFLICT', 'Please try again.');
    await this.auth.challenges.clear(userId, 'email_change');
    await this.auth.deliver(templates.emailChangedNotice(before.email, target), 'email_changed_notice', userId);
    this.logger.info({ event: 'email_changed', userId: String(userId) });
    return this.me(updated);
  }

  // --- Optional phone (D-92): SMS code; phone login is not supported ---------------------------------

  async startPhoneVerification(user: UserWithId, input: PhoneSetRequest): Promise<OtpSentResponse> {
    if (!this.sms) throw new AppError('PROVIDER_NOT_CONFIGURED', 'Phone verification by SMS is not available yet.');
    if (user.phone?.e164 === input.phone && user.phone.verifiedAt) {
      throw new AppError('INVALID_REQUEST', 'This number is already verified on your account.');
    }
    const { otp } = await this.auth.challenges.issue(user._id, 'phone_verification', {
      otp: true,
      target: input.phone,
    });
    try {
      await this.sms.send(templates.phoneOtp(input.phone, otp!));
    } catch (err) {
      this.logger.error({ event: 'phone_sms_failed', userId: String(user._id), reason: (err as Error).message });
      throw new AppError('SERVICE_UNAVAILABLE', "We couldn't send the SMS. Please try again later.");
    }
    const challenge = await this.auth.challenges.find(user._id, 'phone_verification');
    return {
      sent: true,
      destination: maskPhone(input.phone),
      resendAvailableInSeconds: this.auth.challenges.resendWaitSeconds(challenge),
    };
  }

  async verifyPhone(user: UserWithId, otp: string): Promise<UserResponse> {
    const challenge = await this.auth.challenges.verifyOtp(user._id, 'phone_verification', otp);
    if (!challenge.target) throw new AppError('OTP_INVALID');
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      { $set: { phone: { e164: challenge.target, verifiedAt: new Date() } } },
      { returnDocument: 'after' },
    ).lean();
    await this.auth.challenges.clear(user._id, 'phone_verification');
    return this.me(updated!);
  }

  async removePhone(user: UserWithId): Promise<UserResponse> {
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      { $set: { phone: null } },
      { returnDocument: 'after' },
    ).lean();
    await this.auth.challenges.clear(user._id, 'phone_verification');
    return this.me(updated!);
  }

  // --- Account deletion (FR-AUTH-09, D-94): email code + explicit confirmation -------------------------

  async sendDeletionOtp(user: UserWithId): Promise<OtpSentResponse> {
    const { otp } = await this.auth.challenges.issue(user._id, 'account_deletion', { otp: true });
    await this.auth.deliver(templates.accountDeletionOtp(user.email, otp!), 'deletion_email', user._id);
    const challenge = await this.auth.challenges.find(user._id, 'account_deletion');
    return {
      sent: true,
      destination: maskEmail(user.email),
      resendAvailableInSeconds: this.auth.challenges.resendWaitSeconds(challenge),
    };
  }

  /** Tombstone first, then every user record (D-85). Retryable: replay completes a partial deletion. */
  async deleteAccount(user: UserWithId, otp: string): Promise<void> {
    await this.auth.challenges.verifyOtp(user._id, 'account_deletion', otp);
    await deleteAccount(this.models, this.auth.main, this.config.TOMBSTONE_HMAC_KEY, user, 'self_service');
    this.logger.info({ event: 'account_deleted', userId: String(user._id), source: 'self_service' });
  }
}
