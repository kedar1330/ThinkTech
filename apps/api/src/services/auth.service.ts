import type { Logger } from 'pino';
import { Types, type Connection } from 'mongoose';
import {
  LEGAL_VERSIONS,
  type ChangePasswordRequest,
  type ChangePendingEmailRequest,
  type GoogleAuthRequest,
  type GoogleAuthResponse,
  type LoginRequest,
  type OnboardingStep,
  type OtpSentResponse,
  type PendingVerificationResponse,
  type RegisterRequest,
  type RegisterResponse,
  type ResendVerificationRequest,
  type ResetConfirmRequest,
  type ResetRequestRequest,
  type ResetVerifyOtpRequest,
  type SessionResponse,
  type SetupPasswordRequest,
  type UserResponse,
  type VerifyEmailLinkRequest,
  type VerifyEmailOtpRequest,
  type VerifyEmailResponse,
} from '@styleme/contracts';
import {
  ADMIN_RESET_TTL_MS,
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
  PENDING_REGISTRATION_TTL_MS,
  RESET_LINK_TTL_MS,
  RESET_SESSION_TTL_MS,
  VERIFICATION_LINK_TTL_MS,
  type Config,
} from '../config/env';
import type { Models, PendingRegistrationDoc, UserDoc } from '../models/index';
import { randomToken, safeEqual, sha256 } from '../utils/crypto';
import { AppError, secondsUntil } from '../utils/errors';
import { ChallengeService } from './challenges';
import type { GoogleVerifier } from './google';
import type { EmailMessage, EmailSender } from './messaging';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './passwords';
import { SessionService } from './sessions';
import { link, maskEmail, templates } from './templates';

export type UserWithId = UserDoc & { _id: Types.ObjectId };
type PendingWithId = PendingRegistrationDoc & { _id: Types.ObjectId };

const SESSION_ENDED = 'This verification session has ended. Sign up again to get a new code.';
const EMAIL_FAILED = 'We could not send the email. Please try again in a moment.';

/** Server-authoritative onboarding position (FR-ONB-01). Admins are seeded and skip onboarding (D-95). */
export function onboardingStep(user: UserWithId): OnboardingStep {
  if (!user.passwordHash) return 'set_password';
  if (user.role === 'admin') return 'complete';
  if (!user.onboarding?.styleProfileCompletedAt) return 'style_profile';
  if (!user.onboarding?.appearanceCompletedAt) return 'appearance';
  return 'complete';
}

export function toUserResponse(
  user: UserWithId,
  pending: { email?: string | null; phone?: string | null } = {},
): UserResponse {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as UserResponse['role'],
    emailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    googleLinked: typeof user.googleSub === 'string',
    city: user.city ?? null,
    phone: user.phone ? { number: user.phone.e164, verified: Boolean(user.phone.verifiedAt) } : null,
    pendingPhone: pending.phone ?? null,
    pendingEmail: pending.email ?? null,
    marketingOptIn: Boolean(user.consent?.marketingOptIn),
    onboardingStep: onboardingStep(user),
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export interface AuthDeps {
  config: Config;
  models: Models;
  main: Connection;
  email: EmailSender;
  logger: Logger;
  google: GoogleVerifier | null;
}

export class AuthService {
  readonly sessions: SessionService;
  readonly challenges: ChallengeService;
  private readonly config: Config;
  private readonly models: Models;
  readonly main: Connection;
  private readonly email: EmailSender;
  private readonly logger: Logger;
  private readonly googleVerify: GoogleVerifier | null;

  constructor(deps: AuthDeps) {
    this.config = deps.config;
    this.models = deps.models;
    this.main = deps.main;
    this.email = deps.email;
    this.logger = deps.logger;
    this.googleVerify = deps.google;
    this.sessions = new SessionService(deps.models, deps.config.AUTH_ACCESS_TOKEN_SECRET);
    this.challenges = new ChallengeService(deps.models, deps.config.AUTH_ACCESS_TOKEN_SECRET);
  }

  /** Sends an email; a provider failure is logged (without content) and reported as `false`. */
  async deliver(message: EmailMessage, event: string, userId: Types.ObjectId): Promise<boolean> {
    try {
      await this.email.send(message);
      return true;
    } catch (err) {
      this.logger.error({ event: `${event}_failed`, userId: String(userId), reason: (err as Error).message });
      return false;
    }
  }

  private async requireInvite(email: string): Promise<void> {
    if (this.config.PUBLIC_SIGNUP_ENABLED) return;
    if (!(await this.models.BetaInvite.exists({ email }))) throw new AppError('NOT_INVITED');
  }

  // --- Registration and email verification (FR-AUTH-01, FR-AUTH-16) ----------------------------------
  //
  // Registering creates no account. The details and a password hash wait in `pendingRegistrations`
  // (whose `_id` is reserved for the future user) until the emailed 6-digit code is verified; only then
  // is the `users` document created, already verified. A pending registration can be verified only from
  // the browser that registered it (it holds the pending token), so someone who re-registers the same
  // email cannot get their password onto an account that the email's owner then verifies.
  //
  // Unverified `users` created before this design are still verified by the earlier flow (code or link).

  /** Starts a registration and emails the code. Registering again replaces the pending details. */
  async register(input: RegisterRequest): Promise<RegisterResponse> {
    if (await this.models.User.exists({ email: input.email })) throw new AppError('EMAIL_ALREADY_REGISTERED');
    await this.requireInvite(input.email);

    const existing = await this.models.PendingRegistration.findOne({ email: input.email }).lean();
    const challenge = existing ? await this.challenges.find(existing._id, 'email_verification') : null;
    // Re-registering sends a new code, so the resend cooldown and hourly limit apply to it too.
    this.challenges.assertCanSend(challenge);

    const now = new Date();
    let pending: PendingWithId | null;
    try {
      pending = await this.models.PendingRegistration.findOneAndUpdate(
        { email: input.email },
        {
          $set: {
            name: input.fullName,
            passwordHash: await hashPassword(input.password),
            city: input.city,
            phone: input.phone ?? null,
            termsVersion: LEGAL_VERSIONS.terms,
            privacyVersion: LEGAL_VERSIONS.privacy,
            acceptedAt: now,
            marketingOptIn: input.marketingOptIn,
            expiresAt: new Date(now.getTime() + PENDING_REGISTRATION_TTL_MS),
          },
          $setOnInsert: { _id: existing?._id ?? new Types.ObjectId() },
        },
        { upsert: true, returnDocument: 'after' },
      ).lean();
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new AppError('CONFLICT', 'Please try again in a moment.');
      throw err;
    }
    if (!pending) throw new AppError('CONFLICT', 'Please try again in a moment.');

    const pendingToken = randomToken();
    const sent = await this.sendRegistrationCode(pending, {
      pendingTokenHash: sha256(pendingToken),
      rememberMe: input.rememberMe,
      first: !challenge,
    });
    this.logger.info({ event: 'registration_pending', pendingId: String(pending._id) });
    return { email: pending.email, pendingToken, verificationEmailSent: sent };
  }

  /** Issues a new sign-up code (invalidating the previous one) and emails it. */
  private async sendRegistrationCode(
    pending: PendingWithId,
    options: { pendingTokenHash?: string; rememberMe?: boolean; first?: boolean } = {},
  ): Promise<boolean> {
    const issued = await this.challenges.issue(pending._id, 'email_verification', {
      otp: true,
      pendingTokenHash: options.pendingTokenHash,
      rememberMe: options.rememberMe,
      bypassLimits: options.first,
    });
    await this.models.PendingRegistration.updateOne(
      { _id: pending._id },
      { $set: { expiresAt: new Date(Date.now() + PENDING_REGISTRATION_TTL_MS) } },
    );
    return this.deliver(
      templates.registrationOtp(pending.email, pending.name, issued.otp!),
      'verification_email',
      pending._id,
    );
  }

  /** Legacy unverified accounts: a code and a link. */
  private async sendVerification(
    user: UserWithId,
    options: { pendingTokenHash?: string; rememberMe?: boolean; first?: boolean } = {},
  ): Promise<boolean> {
    const issued = await this.challenges.issue(user._id, 'email_verification', {
      otp: true,
      linkTtlMs: VERIFICATION_LINK_TTL_MS,
      pendingTokenHash: options.pendingTokenHash,
      rememberMe: options.rememberMe,
      bypassLimits: options.first,
    });
    const verifyLink = link(this.config.WEB_ORIGIN, '/verify-email/link', issued.linkToken!);
    return this.deliver(
      templates.verifyEmail(user.email, user.name, issued.otp!, verifyLink),
      'verification_email',
      user._id,
    );
  }

  /** The pending registration (or legacy unverified user) that a pending-registration token belongs to. */
  private async findPending(pendingToken: string) {
    const challenge = await this.challenges.findByPendingToken(pendingToken);
    if (!challenge) return null;
    const pending = await this.models.PendingRegistration.findById(challenge.userId).lean();
    if (pending) return { challenge, pending, user: null, email: pending.email };
    const user = await this.models.User.findOne({ _id: challenge.userId, emailVerifiedAt: null }).lean();
    return user ? { challenge, pending: null, user, email: user.email } : null;
  }

  /**
   * Creates the account from a pending registration whose code was just consumed. Code consumption is
   * atomic and `users.email` is unique, so concurrent requests can't create two accounts.
   */
  private async createAccount(pendingId: Types.ObjectId, rememberMe: boolean): Promise<VerifyEmailResponse> {
    const pending = await this.models.PendingRegistration.findById(pendingId).lean();
    if (!pending) throw new AppError('OTP_INVALID');
    let user: UserWithId;
    try {
      const created = await this.models.User.create({
        _id: pending._id,
        email: pending.email,
        name: pending.name,
        role: 'user',
        passwordHash: pending.passwordHash,
        passwordChangedAt: pending.acceptedAt,
        emailVerifiedAt: new Date(),
        city: pending.city,
        phone: pending.phone ? { e164: pending.phone, verifiedAt: null } : null,
        consent: {
          termsVersion: pending.termsVersion,
          termsAcceptedAt: pending.acceptedAt,
          privacyVersion: pending.privacyVersion,
          privacyAcceptedAt: pending.acceptedAt,
          marketingOptIn: pending.marketingOptIn,
          marketingUpdatedAt: pending.acceptedAt,
        },
      });
      user = created.toObject() as UserWithId;
    } catch (err) {
      if (isDuplicateKeyError(err)) {
        await this.discardPending(pending.email);
        throw new AppError('EMAIL_ALREADY_REGISTERED');
      }
      throw err;
    }
    await this.models.PendingRegistration.deleteOne({ _id: pending._id });
    await this.challenges.clear(pending._id, 'email_verification');
    await this.models.BetaInvite.updateOne({ email: user.email, usedAt: null }, { $set: { usedAt: new Date() } });
    this.logger.info({ event: 'account_registered', userId: String(user._id) });
    const accessToken = await this.sessions.create(user._id, user.tokenVersion, rememberMe);
    return { verified: true, email: user.email, accessToken, onboardingStep: onboardingStep(user) };
  }

  /** Ends a pending registration (its email became an account another way, e.g. Google). */
  private async discardPending(email: string): Promise<void> {
    const pending = await this.models.PendingRegistration.findOneAndDelete({ email }).lean();
    if (pending) await this.challenges.clear(pending._id, 'email_verification');
  }

  /** Legacy unverified account: opens a session only for the browser holding the pending token. */
  private async completeVerification(
    userId: Types.ObjectId,
    challenge: { pendingTokenHash?: string | null; rememberMe?: boolean | null },
    pendingToken: string | undefined,
  ): Promise<VerifyEmailResponse> {
    const user = await this.models.User.findOneAndUpdate(
      { _id: userId, isActive: true },
      { $set: { emailVerifiedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();
    if (!user) throw new AppError('OTP_INVALID');
    await this.challenges.clear(userId, 'email_verification');
    this.logger.info({ event: 'email_verified', userId: String(userId) });

    const sameBrowser =
      pendingToken !== undefined &&
      challenge.pendingTokenHash != null &&
      challenge.pendingTokenHash === sha256(pendingToken);
    if (!sameBrowser) return { verified: true, email: user.email };
    const accessToken = await this.sessions.create(user._id, user.tokenVersion, Boolean(challenge.rememberMe));
    return { verified: true, email: user.email, accessToken, onboardingStep: onboardingStep(user) };
  }

  async verifyEmailOtp(input: VerifyEmailOtpRequest): Promise<VerifyEmailResponse> {
    const pending = await this.models.PendingRegistration.findOne({ email: input.email }).lean();
    if (pending) {
      const challenge = await this.challenges.find(pending._id, 'email_verification');
      const sameBrowser =
        input.pendingToken !== undefined &&
        typeof challenge?.pendingTokenHash === 'string' &&
        safeEqual(challenge.pendingTokenHash, sha256(input.pendingToken));
      if (!sameBrowser) throw new AppError('NOT_FOUND', SESSION_ENDED);
      const consumed = await this.challenges.verifyOtp(pending._id, 'email_verification', input.otp);
      return this.createAccount(pending._id, Boolean(consumed.rememberMe));
    }
    const user = await this.models.User.findOne({ email: input.email, emailVerifiedAt: null, isActive: true }).lean();
    if (!user) throw new AppError('OTP_INVALID');
    const challenge = await this.challenges.verifyOtp(user._id, 'email_verification', input.otp);
    return this.completeVerification(user._id, challenge, input.pendingToken);
  }

  /** Verification links exist only for legacy unverified accounts; sign-up codes have no link. */
  async verifyEmailLink(input: VerifyEmailLinkRequest): Promise<VerifyEmailResponse> {
    const challenge = await this.challenges.consumeLink(['email_verification'], input.token);
    return this.completeVerification(challenge.userId, challenge, input.pendingToken);
  }

  /** The pending registration a browser is working on (verification page after a refresh). */
  async pendingVerification(pendingToken: string): Promise<PendingVerificationResponse> {
    const found = await this.findPending(pendingToken);
    if (!found) throw new AppError('NOT_FOUND', SESSION_ENDED);
    return {
      email: found.email,
      resendAvailableInSeconds: this.challenges.resendWaitSeconds(found.challenge),
      codeExpiresInSeconds: this.challenges.codeExpiresInSeconds(found.challenge),
    };
  }

  /**
   * Resend. With the pending-registration token the caller learns about cooldowns and delivery
   * failures; recovery by email alone (legacy unverified accounts only) always gets the same generic
   * response (no account enumeration).
   */
  async resendVerification(
    input: ResendVerificationRequest,
  ): Promise<{ accepted: true; resendAvailableInSeconds?: number }> {
    if (input.pendingToken) {
      const found = await this.findPending(input.pendingToken);
      if (!found || found.email !== input.email) throw new AppError('NOT_FOUND', SESSION_ENDED);
      const id = found.pending?._id ?? found.user!._id;
      const sent = found.pending
        ? await this.sendRegistrationCode(found.pending)
        : await this.sendVerification(found.user!);
      if (!sent) throw new AppError('SERVICE_UNAVAILABLE', EMAIL_FAILED);
      return {
        accepted: true,
        resendAvailableInSeconds: this.challenges.resendWaitSeconds(
          await this.challenges.find(id, 'email_verification'),
        ),
      };
    }
    const user = await this.models.User.findOne({ email: input.email, emailVerifiedAt: null, isActive: true }).lean();
    if (user) {
      try {
        await this.sendVerification(user);
      } catch (err) {
        if (!(err instanceof AppError)) throw err; // cooldown or limit: stay generic
      }
    }
    return { accepted: true };
  }

  /** Corrects the email of a pending registration; earlier codes (and links) stop working. */
  async changePendingEmail(
    input: ChangePendingEmailRequest,
  ): Promise<{ email: string; verificationEmailSent: boolean }> {
    const found = await this.findPending(input.pendingToken);
    if (!found) throw new AppError('NOT_FOUND', SESSION_ENDED);
    if (input.newEmail === found.email)
      throw new AppError('INVALID_REQUEST', 'This is already the email on your account.');
    if (await this.models.User.exists({ email: input.newEmail })) throw new AppError('EMAIL_ALREADY_REGISTERED');
    await this.requireInvite(input.newEmail);

    const wait = this.challenges.resendWaitSeconds(found.challenge);
    if (wait > 0) throw new AppError('RESEND_COOLDOWN', undefined, wait);

    if (found.pending) {
      try {
        await this.models.PendingRegistration.updateOne(
          { _id: found.pending._id },
          { $set: { email: input.newEmail } },
        );
      } catch (err) {
        if (isDuplicateKeyError(err))
          throw new AppError('CONFLICT', 'A sign-up with this email is already waiting for verification.');
        throw err;
      }
      const sent = await this.sendRegistrationCode({ ...found.pending, email: input.newEmail });
      this.logger.info({ event: 'pending_email_changed', pendingId: String(found.pending._id) });
      return { email: input.newEmail, verificationEmailSent: sent };
    }

    const user = found.user!;
    try {
      await this.models.User.updateOne({ _id: user._id, emailVerifiedAt: null }, { $set: { email: input.newEmail } });
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new AppError('EMAIL_ALREADY_REGISTERED');
      throw err;
    }
    const sent = await this.sendVerification({ ...user, email: input.newEmail });
    this.logger.info({ event: 'pending_email_changed', userId: String(user._id) });
    return { email: input.newEmail, verificationEmailSent: sent };
  }

  // --- Login (FR-AUTH-03, D-90) ----------------------------------------------------------------------

  async login(input: LoginRequest): Promise<SessionResponse> {
    const user = await this.models.User.findOne({ email: input.email }).lean();
    if (!user) {
      // A sign-up that was never verified has no account yet; tell only someone who knows its password.
      const pending = await this.models.PendingRegistration.findOne({ email: input.email }).lean();
      const pendingMatch = pending
        ? await verifyPassword(pending.passwordHash, input.password)
        : (await verifyAgainstDummy(input.password), false);
      if (pendingMatch) throw new AppError('REGISTRATION_PENDING');
      throw new AppError('UNAUTHENTICATED', 'Incorrect email or password.');
    }
    const lockedUntil = user.loginSecurity?.lockedUntil;
    if (lockedUntil && lockedUntil > new Date())
      throw new AppError('ACCOUNT_LOCKED', undefined, secondsUntil(lockedUntil));

    const ok = user.passwordHash
      ? await verifyPassword(user.passwordHash, input.password)
      : (await verifyAgainstDummy(input.password), false);
    if (!ok) {
      await this.recordLoginFailure(user._id);
      throw new AppError('UNAUTHENTICATED', 'Incorrect email or password.');
    }
    if (!user.isActive) throw new AppError('UNAUTHENTICATED', 'Incorrect email or password.');
    await this.models.User.updateOne(
      { _id: user._id },
      { $set: { 'loginSecurity.failedCount': 0, 'loginSecurity.lockedUntil': null } },
    );
    if (!user.emailVerifiedAt) throw new AppError('EMAIL_NOT_VERIFIED');

    const accessToken = await this.sessions.create(user._id, user.tokenVersion, input.rememberMe);
    return { accessToken, onboardingStep: onboardingStep(user) };
  }

  private async recordLoginFailure(userId: Types.ObjectId): Promise<void> {
    const updated = await this.models.User.findOneAndUpdate(
      { _id: userId },
      { $inc: { 'loginSecurity.failedCount': 1 } },
      { returnDocument: 'after' },
    ).lean();
    if ((updated?.loginSecurity?.failedCount ?? 0) >= LOGIN_MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
      await this.models.User.updateOne(
        { _id: userId },
        { $set: { 'loginSecurity.failedCount': 0, 'loginSecurity.lockedUntil': lockedUntil } },
      );
      this.logger.warn({ event: 'login_locked', userId: String(userId) });
      throw new AppError('ACCOUNT_LOCKED', undefined, secondsUntil(lockedUntil));
    }
  }

  async logout(sid: string): Promise<void> {
    await this.sessions.revoke(sid);
  }

  // --- Google (FR-AUTH-15, D-88) ---------------------------------------------------------------------

  async google(input: GoogleAuthRequest): Promise<GoogleAuthResponse> {
    if (!this.googleVerify) throw new AppError('PROVIDER_NOT_CONFIGURED', 'Google sign-in is not available yet.');
    const identity = await this.googleVerify(input.idToken, input.nonce);

    const bySub = await this.models.User.findOne({ googleSub: identity.sub }).lean();
    const byEmail = bySub ?? (await this.models.User.findOne({ email: identity.email }).lean());

    if (byEmail) {
      if (input.intent === 'signup') throw new AppError('GOOGLE_ACCOUNT_EXISTS');
      if (!byEmail.isActive) throw new AppError('UNAUTHENTICATED', 'Google sign-in could not be completed.');

      const lockedUntil = byEmail.loginSecurity?.lockedUntil;
      if (lockedUntil && lockedUntil > new Date())
        throw new AppError('ACCOUNT_LOCKED', undefined, secondsUntil(lockedUntil));

      let user: UserWithId = byEmail;
      let linked = false;
      if (byEmail.googleSub !== identity.sub) {
        if (typeof byEmail.googleSub === 'string') {
          throw new AppError('FORBIDDEN', 'This StyleMe account is linked to a different Google account.');
        }
        user = await this.linkGoogle(byEmail, identity.sub);
        linked = true;
      }
      const accessToken = await this.sessions.create(user._id, user.tokenVersion, input.rememberMe);
      return { accessToken, onboardingStep: onboardingStep(user), created: false, linked };
    }

    if (input.intent === 'login') throw new AppError('GOOGLE_NO_ACCOUNT');
    if (!input.acceptTerms)
      throw new AppError('INVALID_REQUEST', 'Accept the Terms of Service and Privacy Policy to continue');
    await this.requireInvite(identity.email);
    const now = new Date();
    let created: UserWithId;
    try {
      created = (
        await this.models.User.create({
          email: identity.email,
          name: identity.name ?? identity.email.split('@')[0],
          role: 'user',
          googleSub: identity.sub,
          emailVerifiedAt: now,
          passwordHash: null,
          consent: {
            termsVersion: LEGAL_VERSIONS.terms,
            termsAcceptedAt: now,
            privacyVersion: LEGAL_VERSIONS.privacy,
            privacyAcceptedAt: now,
            marketingOptIn: input.marketingOptIn,
            marketingUpdatedAt: now,
          },
        })
      ).toObject() as UserWithId;
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new AppError('GOOGLE_ACCOUNT_EXISTS');
      throw err;
    }
    await this.models.BetaInvite.updateOne({ email: identity.email, usedAt: null }, { $set: { usedAt: now } });
    await this.discardPending(identity.email);
    this.logger.info({ event: 'account_registered_google', userId: String(created._id) });
    const accessToken = await this.sessions.create(created._id, created.tokenVersion, input.rememberMe);
    return { accessToken, onboardingStep: onboardingStep(created), created: true, linked: false };
  }

  /**
   * Links a Google identity to an existing account after Google verified the email. If that account's
   * email was never verified, whoever registered it had not proved they own the address, so their
   * password and sessions are discarded first (pre-registration takeover protection); the Google user
   * then sets their own password during onboarding.
   */
  private async linkGoogle(user: UserWithId, sub: string): Promise<UserWithId> {
    const unverified = !user.emailVerifiedAt;
    const update = unverified
      ? { $set: { googleSub: sub, emailVerifiedAt: new Date(), passwordHash: null }, $inc: { tokenVersion: 1 } }
      : { $set: { googleSub: sub } };
    let updated: UserWithId | null;
    try {
      updated = await this.models.User.findOneAndUpdate({ _id: user._id, googleSub: { $exists: false } }, update, {
        returnDocument: 'after',
      }).lean();
    } catch (err) {
      if (isDuplicateKeyError(err))
        throw new AppError('FORBIDDEN', 'This Google account is already linked to another StyleMe account.');
      throw err;
    }
    if (!updated) throw new AppError('CONFLICT', 'Please try signing in with Google again.');
    if (unverified) {
      await this.sessions.revokeAll(user._id);
      await this.challenges.clearAll(user._id);
    }
    this.logger.info({ event: 'google_linked', userId: String(user._id), takeoverProtection: unverified });
    return updated;
  }

  /** Google-registered users create their StyleMe password before onboarding (D-88). */
  async setupPassword(user: UserWithId, input: SetupPasswordRequest): Promise<{ onboardingStep: OnboardingStep }> {
    if (user.passwordHash) throw new AppError('CONFLICT', 'Your account already has a password.');
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id, passwordHash: null },
      { $set: { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new AppError('CONFLICT', 'Your account already has a password.');
    return { onboardingStep: onboardingStep(updated) };
  }

  // --- Password reset (FR-AUTH-13, D-89) --------------------------------------------------------------

  async requestPasswordReset(
    input: ResetRequestRequest,
  ): Promise<{ accepted: true; method: 'link' | 'otp'; resendAvailableInSeconds: number }> {
    const user = await this.models.User.findOne({ email: input.email }).lean();
    // Agreed UI decision: tell the user the email isn't registered (with a Sign Up link). Rate limits apply.
    if (!user) throw new AppError('EMAIL_NOT_REGISTERED');
    if (user.isActive) {
      if (input.method === 'otp') {
        const { otp } = await this.challenges.issue(user._id, 'password_reset', { otp: true });
        await this.deliver(templates.resetPasswordOtp(user.email, otp!), 'reset_email', user._id);
      } else {
        const { linkToken } = await this.challenges.issue(user._id, 'password_reset', { linkTtlMs: RESET_LINK_TTL_MS });
        await this.deliver(
          templates.resetPasswordLink(user.email, link(this.config.WEB_ORIGIN, '/reset-password', linkToken!)),
          'reset_email',
          user._id,
        );
      }
    }
    const challenge = await this.challenges.find(user._id, 'password_reset');
    return {
      accepted: true,
      method: input.method,
      resendAvailableInSeconds: this.challenges.resendWaitSeconds(challenge),
    };
  }

  /** A correct reset code is exchanged for a single-use token to set the new password. */
  async verifyResetOtp(input: ResetVerifyOtpRequest): Promise<{ resetToken: string }> {
    const user = await this.models.User.findOne({ email: input.email, isActive: true }).lean();
    if (!user) throw new AppError('OTP_INVALID');
    const challenge = await this.challenges.verifyOtp(user._id, 'password_reset', input.otp);
    const resetToken = randomToken();
    await this.models.AuthChallenge.updateOne(
      { _id: challenge._id },
      {
        $set: {
          linkHash: sha256(resetToken),
          linkExpiresAt: new Date(Date.now() + RESET_SESSION_TTL_MS),
          consumedAt: null,
          otpHash: null,
          otpExpiresAt: null,
        },
      },
    );
    return { resetToken };
  }

  /** FR-AUTH-14: sets the password, revokes every session and token, clears a login lockout. */
  async confirmPasswordReset(input: ResetConfirmRequest): Promise<void> {
    const challenge = await this.challenges.consumeLink(['password_reset'], input.token).catch(() => {
      throw new AppError('LINK_INVALID', 'This reset link or code is invalid or has expired.');
    });
    const now = new Date();
    const user = await this.models.User.findOneAndUpdate(
      { _id: challenge.userId, isActive: true },
      {
        $set: {
          passwordHash: await hashPassword(input.newPassword),
          passwordChangedAt: now,
          'loginSecurity.failedCount': 0,
          'loginSecurity.lockedUntil': null,
        },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!user) throw new AppError('LINK_INVALID', 'This reset link or code is invalid or has expired.');
    // Receiving the code or link proves control of the address.
    if (!user.emailVerifiedAt) await this.models.User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: now } });
    await this.challenges.clear(user._id, 'password_reset');
    await this.sessions.revokeAll(user._id);
    this.logger.info({
      event: 'password_reset_completed',
      userId: String(user._id),
      adminIssued: Boolean(challenge.issuedBy),
    });
  }

  /** Admin-assisted recovery (FR-AUTH-12): a single-use code the user redeems on the reset page. */
  async issueAdminResetCode(userId: Types.ObjectId, issuedBy: Types.ObjectId | null): Promise<string> {
    const { linkToken } = await this.challenges.issue(userId, 'password_reset', {
      linkTtlMs: ADMIN_RESET_TTL_MS,
      issuedBy,
      bypassLimits: true,
    });
    this.logger.info({
      event: 'password_reset_code_issued',
      userId: String(userId),
      issuedBy: issuedBy ? String(issuedBy) : null,
    });
    return linkToken!;
  }

  // --- Password change while logged in (FR-AUTH-11, D-93) --------------------------------------------

  async sendPasswordChangeOtp(user: UserWithId): Promise<OtpSentResponse> {
    const { otp } = await this.challenges.issue(user._id, 'password_change', { otp: true });
    await this.deliver(templates.passwordChangeOtp(user.email, otp!), 'password_change_email', user._id);
    const challenge = await this.challenges.find(user._id, 'password_change');
    return {
      sent: true,
      destination: maskEmail(user.email),
      resendAvailableInSeconds: this.challenges.resendWaitSeconds(challenge),
    };
  }

  /** Verifies the emailed code, sets the password, revokes all other sessions and keeps this browser signed in. */
  async changePassword(user: UserWithId, sid: string, input: ChangePasswordRequest): Promise<string> {
    await this.challenges.verifyOtp(user._id, 'password_change', input.otp);
    const current = await this.sessions.find(sid, String(user._id));
    const updated = await this.models.User.findOneAndUpdate(
      { _id: user._id },
      {
        $set: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw new AppError('UNAUTHENTICATED');
    await this.challenges.clear(user._id, 'password_change');
    await this.challenges.clear(user._id, 'password_reset');
    await this.sessions.revokeAll(user._id);
    await this.deliver(templates.passwordChanged(updated.email), 'password_changed_email', user._id);
    return this.sessions.create(updated._id, updated.tokenVersion, Boolean(current?.remember));
  }
}
