import type { Request, RequestHandler } from 'express';
import type {
  AccountDetailsRequest,
  ChangePasswordRequest,
  ChangePendingEmailRequest,
  DeleteAccountRequest,
  EmailChangeRequest,
  GoogleAuthRequest,
  LoginRequest,
  PhoneSetRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetConfirmRequest,
  ResetRequestRequest,
  ResetVerifyOtpRequest,
  SetupPasswordRequest,
  VerifyEmailLinkRequest,
  VerifyEmailOtpRequest,
} from '@styleme/contracts';
import type { AccountService } from '../services/account.service';
import type { AuthService } from '../services/auth.service';
import type { OnboardingService } from '../services/onboarding.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

function requireAuth(req: Request) {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  return req.auth;
}

/** HTTP only: reads validated input, calls a service, writes the envelope. */
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly account: AccountService,
    private readonly onboarding: OnboardingService,
  ) {}

  // Public
  register: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.register(req.body as RegisterRequest), 201);
  login: RequestHandler = async (req, res) => sendData(res, await this.auth.login(req.body as LoginRequest));
  google: RequestHandler = async (req, res) => sendData(res, await this.auth.google(req.body as GoogleAuthRequest));
  verifyEmailOtp: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.verifyEmailOtp(req.body as VerifyEmailOtpRequest));
  verifyEmailLink: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.verifyEmailLink(req.body as VerifyEmailLinkRequest));
  resendVerification: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.resendVerification(req.body as ResendVerificationRequest), 202);
  pendingVerification: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.pendingVerification((req.body as { pendingToken: string }).pendingToken));
  changePendingEmail: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.changePendingEmail(req.body as ChangePendingEmailRequest));
  requestReset: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.requestPasswordReset(req.body as ResetRequestRequest), 202);
  verifyResetOtp: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.verifyResetOtp(req.body as ResetVerifyOtpRequest));
  confirmReset: RequestHandler = async (req, res) => {
    await this.auth.confirmPasswordReset(req.body as ResetConfirmRequest);
    sendData(res, { reset: true });
  };
  confirmEmailChangeLink: RequestHandler = async (req, res) =>
    sendData(res, await this.account.confirmEmailChangeLink((req.body as { token: string }).token));

  // Signed in
  me: RequestHandler = async (req, res) => sendData(res, await this.account.me(requireAuth(req).user));
  logout: RequestHandler = async (req, res) => {
    await this.auth.logout(requireAuth(req).sid);
    sendData(res, { loggedOut: true });
  };
  setupPassword: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.setupPassword(requireAuth(req).user, req.body as SetupPasswordRequest));
  sendPasswordChangeOtp: RequestHandler = async (req, res) =>
    sendData(res, await this.auth.sendPasswordChangeOtp(requireAuth(req).user));
  changePassword: RequestHandler = async (req, res) => {
    const { user, sid } = requireAuth(req);
    sendData(res, { accessToken: await this.auth.changePassword(user, sid, req.body as ChangePasswordRequest) });
  };
  updateDetails: RequestHandler = async (req, res) =>
    sendData(res, await this.account.updateDetails(requireAuth(req).user, req.body as AccountDetailsRequest));
  startEmailChange: RequestHandler = async (req, res) =>
    sendData(res, await this.account.startEmailChange(requireAuth(req).user, req.body as EmailChangeRequest));
  verifyEmailChange: RequestHandler = async (req, res) =>
    sendData(res, await this.account.verifyEmailChangeOtp(requireAuth(req).user, (req.body as { otp: string }).otp));
  startPhone: RequestHandler = async (req, res) =>
    sendData(res, await this.account.startPhoneVerification(requireAuth(req).user, req.body as PhoneSetRequest));
  verifyPhone: RequestHandler = async (req, res) =>
    sendData(res, await this.account.verifyPhone(requireAuth(req).user, (req.body as { otp: string }).otp));
  removePhone: RequestHandler = async (req, res) =>
    sendData(res, await this.account.removePhone(requireAuth(req).user));
  sendDeletionOtp: RequestHandler = async (req, res) =>
    sendData(res, await this.account.sendDeletionOtp(requireAuth(req).user));
  deleteAccount: RequestHandler = async (req, res) => {
    await this.account.deleteAccount(requireAuth(req).user, (req.body as DeleteAccountRequest).otp);
    sendData(res, { deleted: true });
  };
  onboardingStatus: RequestHandler = async (req, res) => sendData(res, this.onboarding.status(requireAuth(req).user));
  completeStyleProfile: RequestHandler = async (req, res) =>
    sendData(res, await this.onboarding.completeStyleProfile(requireAuth(req).user));
  completeAppearance: RequestHandler = async (req, res) =>
    sendData(res, await this.onboarding.completeAppearance(requireAuth(req).user));
  skipOnboarding: RequestHandler = async (req, res) => sendData(res, await this.onboarding.skip(requireAuth(req).user));
}
