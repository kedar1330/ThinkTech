import { z } from 'zod';

// Request and response shapes for /v1/auth/* and /v1/account (API.md §3.1).

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

// At least 8 characters (FR-AUTH-01). The upper bound keeps argon2 hashing cost bounded.
export const passwordSchema = z.string().min(8).max(256);

export const nameSchema = z.string().trim().min(1).max(100);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // Not length-checked beyond the upper bound, so a short wrong password still gets the generic login error.
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const deleteAccountRequestSchema = z.object({
  password: z.string().min(1).max(256),
});
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

export const resetConfirmRequestSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: passwordSchema,
});
export type ResetConfirmRequest = z.infer<typeof resetConfirmRequestSchema>;

export const resetRequestRequestSchema = z.object({
  email: emailSchema,
});
export type ResetRequestRequest = z.infer<typeof resetRequestRequestSchema>;

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['user', 'admin']),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

export const accessTokenResponseSchema = z.object({ accessToken: z.string() });
export type AccessTokenResponse = z.infer<typeof accessTokenResponseSchema>;

// Fixed user-facing messages, kept identical across cases so responses don't reveal account state.
export const AUTH_MESSAGES = {
  loginFailed: 'Incorrect email or password.',
  registrationRefused:
    "We couldn't create an account with this email. If you already have an account, log in; otherwise contact the StyleMe team.",
  resetTokenInvalid: 'This reset code is invalid or has expired.',
  resetEmailDisabled: "Password reset by email isn't available during the beta — please contact the StyleMe team.",
  passwordIncorrect: 'The password you entered is incorrect.',
} as const;

// Headers the Next.js server (BFF) sends so the API can rate-limit per end-user IP. The client-IP
// header is trusted only together with the shared BFF secret (SECURITY.md §5).
export const BFF_KEY_HEADER = 'x-styleme-bff-key';
export const CLIENT_IP_HEADER = 'x-styleme-client-ip';
