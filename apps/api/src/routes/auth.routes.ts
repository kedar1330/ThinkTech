import { Router, type RequestHandler } from 'express';
import {
  accountDetailsRequestSchema,
  changePasswordRequestSchema,
  changePendingEmailRequestSchema,
  deleteAccountRequestSchema,
  emailChangeRequestSchema,
  googleAuthRequestSchema,
  loginRequestSchema,
  otpOnlyRequestSchema,
  pendingRequestSchema,
  phoneSetRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resetConfirmRequestSchema,
  resetRequestRequestSchema,
  resetVerifyOtpRequestSchema,
  setupPasswordRequestSchema,
  tokenOnlyRequestSchema,
  verifyEmailLinkRequestSchema,
  verifyEmailOtpRequestSchema,
} from '@styleme/contracts';
import type { AuthController } from '../controllers/auth.controller';
import type { AuthRateLimits } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';

// /v1/auth/*, /v1/account* and /v1/onboarding* (API.md §3.1). Pipeline: route → rate limits /
// authentication → validation → controller → service.
export function authRoutes(
  c: AuthController,
  auth: RequestHandler,
  withPassword: RequestHandler[],
  limits: AuthRateLimits,
): Router {
  const r = Router();

  // Public
  r.post('/auth/register', ...limits.register, validateBody(registerRequestSchema), c.register);
  r.post('/auth/login', ...limits.login, validateBody(loginRequestSchema), c.login);
  r.post('/auth/google', ...limits.google, validateBody(googleAuthRequestSchema), c.google);
  r.post(
    '/auth/email-verification/otp',
    ...limits.codeCheck,
    validateBody(verifyEmailOtpRequestSchema),
    c.verifyEmailOtp,
  );
  r.post(
    '/auth/email-verification/link',
    ...limits.codeCheck,
    validateBody(verifyEmailLinkRequestSchema),
    c.verifyEmailLink,
  );
  r.post(
    '/auth/email-verification/resend',
    ...limits.codeSend,
    validateBody(resendVerificationRequestSchema),
    c.resendVerification,
  );
  r.post(
    '/auth/email-verification/pending',
    ...limits.codeCheck,
    validateBody(pendingRequestSchema),
    c.pendingVerification,
  );
  r.put(
    '/auth/email-verification/email',
    ...limits.codeSend,
    validateBody(changePendingEmailRequestSchema),
    c.changePendingEmail,
  );
  r.post('/auth/password-reset/request', ...limits.codeSend, validateBody(resetRequestRequestSchema), c.requestReset);
  r.post(
    '/auth/password-reset/verify-otp',
    ...limits.codeCheck,
    validateBody(resetVerifyOtpRequestSchema),
    c.verifyResetOtp,
  );
  r.post(
    '/auth/password-reset/confirm',
    ...limits.resetConfirm,
    validateBody(resetConfirmRequestSchema),
    c.confirmReset,
  );
  r.post(
    '/account/email-change/confirm',
    ...limits.codeCheck,
    validateBody(tokenOnlyRequestSchema),
    c.confirmEmailChangeLink,
  );

  // Signed in
  r.get('/auth/me', auth, c.me);
  r.post('/auth/logout', auth, ...limits.logout, c.logout);
  r.post('/auth/password/setup', auth, validateBody(setupPasswordRequestSchema), c.setupPassword);
  r.post('/auth/password/change-otp', ...withPassword, ...limits.accountSecurity, c.sendPasswordChangeOtp);
  r.put(
    '/auth/password',
    ...withPassword,
    ...limits.accountSecurity,
    validateBody(changePasswordRequestSchema),
    c.changePassword,
  );
  r.put('/account/details', auth, validateBody(accountDetailsRequestSchema), c.updateDetails);
  r.post(
    '/account/email-change',
    ...withPassword,
    ...limits.accountSecurity,
    validateBody(emailChangeRequestSchema),
    c.startEmailChange,
  );
  r.post(
    '/account/email-change/verify',
    ...withPassword,
    ...limits.accountSecurity,
    validateBody(otpOnlyRequestSchema),
    c.verifyEmailChange,
  );
  r.put(
    '/account/phone',
    ...withPassword,
    ...limits.accountSecurity,
    validateBody(phoneSetRequestSchema),
    c.startPhone,
  );
  r.post(
    '/account/phone/verify',
    ...withPassword,
    ...limits.accountSecurity,
    validateBody(otpOnlyRequestSchema),
    c.verifyPhone,
  );
  r.delete('/account/phone', ...withPassword, c.removePhone);
  r.post('/account/deletion-otp', auth, ...limits.accountSecurity, c.sendDeletionOtp);
  r.delete('/account', auth, ...limits.deleteAccount, validateBody(deleteAccountRequestSchema), c.deleteAccount);
  r.get('/onboarding', auth, c.onboardingStatus);
  r.post('/onboarding/style-profile/complete', ...withPassword, c.completeStyleProfile);
  r.post('/onboarding/appearance/complete', ...withPassword, c.completeAppearance);
  r.post('/onboarding/skip', ...withPassword, c.skipOnboarding);

  return r;
}
