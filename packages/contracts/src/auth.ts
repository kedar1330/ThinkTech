import { z } from 'zod';
import { cityIdSchema } from './cities';

// Request and response shapes for /v1/auth/*, /v1/account* and /v1/onboarding (API.md §3.1).

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
export const fullNameSchema = z.string().trim().min(1, 'Enter your full name').max(100);
/** @deprecated use fullNameSchema */
export const nameSchema = fullNameSchema;

// --- Password policy (D-87): at least 8 characters with upper case, lower case, a number and a special
// character. The upper bound keeps argon2 hashing cost bounded. Shown to users as a live checklist.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'upper', label: 'One upper-case letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lower-case letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: 'One special character (e.g. ! @ # $)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

export function passwordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
}

export const passwordSchema = z
  .string()
  .max(128, 'Use at most 128 characters')
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) ctx.addIssue({ code: 'custom', message: rule.label });
    }
  });

/** For login and re-authentication: any stored password, including ones set before the policy. */
export const currentPasswordSchema = z.string().min(1).max(256);

export const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');
export const tokenSchema = z.string().min(16).max(256);

/** Indian mobile numbers, normalised to E.164 (+91 followed by 10 digits starting 6–9). */
export const indianPhoneSchema = z
  .string()
  .trim()
  .transform((raw) => raw.replace(/[\s\-()]/g, ''))
  .transform((raw) => raw.replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid Indian mobile number'))
  .transform((digits) => `+91${digits}`);

// --- Registration (FR-AUTH-01, D-87) --------------------------------------------------------------

export const registerRequestSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    city: cityIdSchema,
    phone: indianPhoneSchema.optional().nullable(),
    acceptTerms: z.literal(true, { message: 'Accept the Terms of Service and Privacy Policy to continue' }),
    marketingOptIn: z.boolean().default(false),
    rememberMe: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

/** The pending-registration token stays on the server side of the BFF (an HttpOnly cookie). */
export interface RegisterResponse {
  email: string;
  pendingToken: string;
  verificationEmailSent: boolean;
}

// --- Login (FR-AUTH-03) ---------------------------------------------------------------------------

export const loginRequestSchema = z
  .object({ email: emailSchema, password: currentPasswordSchema, rememberMe: z.boolean().default(false) })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const ONBOARDING_STEPS = ['set_password', 'style_profile', 'appearance', 'complete'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface SessionResponse {
  accessToken: string;
  onboardingStep: OnboardingStep;
}

// --- Google (FR-AUTH-15, D-88) --------------------------------------------------------------------

export const googleAuthRequestSchema = z
  .object({
    idToken: z.string().min(20).max(8192),
    nonce: z.string().min(16).max(256),
    intent: z.enum(['signup', 'login']),
    rememberMe: z.boolean().default(false),
    acceptTerms: z.boolean().default(false),
    marketingOptIn: z.boolean().default(false),
  })
  .strict();
export type GoogleAuthRequest = z.infer<typeof googleAuthRequestSchema>;

export interface GoogleAuthResponse extends SessionResponse {
  created: boolean;
  linked: boolean;
}

export const setupPasswordRequestSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .strict()
  .refine((v) => v.password === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type SetupPasswordRequest = z.infer<typeof setupPasswordRequestSchema>;

// --- Email verification (FR-AUTH-16) ----------------------------------------------------------------

export const verifyEmailOtpRequestSchema = z
  .object({ email: emailSchema, otp: otpSchema, pendingToken: tokenSchema.optional() })
  .strict();
export type VerifyEmailOtpRequest = z.infer<typeof verifyEmailOtpRequestSchema>;

export const verifyEmailLinkRequestSchema = z
  .object({ token: tokenSchema, pendingToken: tokenSchema.optional() })
  .strict();
export type VerifyEmailLinkRequest = z.infer<typeof verifyEmailLinkRequestSchema>;

/** `accessToken` is present only when the pending-registration token proved it's the same browser. */
export interface VerifyEmailResponse {
  verified: true;
  email: string;
  accessToken?: string;
  onboardingStep?: OnboardingStep;
}

export const resendVerificationRequestSchema = z
  .object({ email: emailSchema, pendingToken: tokenSchema.optional() })
  .strict();
export type ResendVerificationRequest = z.infer<typeof resendVerificationRequestSchema>;

export const changePendingEmailRequestSchema = z.object({ pendingToken: tokenSchema, newEmail: emailSchema }).strict();
export type ChangePendingEmailRequest = z.infer<typeof changePendingEmailRequestSchema>;

export const pendingRequestSchema = z.object({ pendingToken: tokenSchema }).strict();

export interface PendingVerificationResponse {
  email: string;
  resendAvailableInSeconds: number;
  /** Seconds until the current code expires (0 when it has expired or was used). */
  codeExpiresInSeconds: number;
}

// --- Password reset (FR-AUTH-13, D-89) ----------------------------------------------------------------

export const resetRequestRequestSchema = z.object({ email: emailSchema, method: z.enum(['link', 'otp']) }).strict();
export type ResetRequestRequest = z.infer<typeof resetRequestRequestSchema>;

export const resetVerifyOtpRequestSchema = z.object({ email: emailSchema, otp: otpSchema }).strict();
export type ResetVerifyOtpRequest = z.infer<typeof resetVerifyOtpRequestSchema>;

export const resetConfirmRequestSchema = z
  .object({ token: tokenSchema, newPassword: passwordSchema, confirmPassword: z.string() })
  .strict()
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type ResetConfirmRequest = z.infer<typeof resetConfirmRequestSchema>;

// --- Account settings (FR-AUTH-11, -17 … -19) --------------------------------------------------------

export const changePasswordRequestSchema = z
  .object({ otp: otpSchema, newPassword: passwordSchema, confirmPassword: z.string() })
  .strict()
  .refine((v) => v.newPassword === v.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

export const emailChangeRequestSchema = z.object({ password: currentPasswordSchema, newEmail: emailSchema }).strict();
export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>;

export const otpOnlyRequestSchema = z.object({ otp: otpSchema }).strict();
export const tokenOnlyRequestSchema = z.object({ token: tokenSchema }).strict();

export const phoneSetRequestSchema = z.object({ phone: indianPhoneSchema }).strict();
export type PhoneSetRequest = z.infer<typeof phoneSetRequestSchema>;

export const accountDetailsRequestSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    city: cityIdSchema.optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });
export type AccountDetailsRequest = z.infer<typeof accountDetailsRequestSchema>;

export const deleteAccountRequestSchema = z
  .object({ otp: otpSchema, confirm: z.literal(true, { message: 'Confirm that you want to delete your account' }) })
  .strict();
export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;

// --- Current user ------------------------------------------------------------------------------------

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  city: string | null;
  phone: { number: string; verified: boolean } | null;
  pendingPhone: string | null;
  pendingEmail: string | null;
  marketingOptIn: boolean;
  onboardingStep: OnboardingStep;
}

export interface OtpSentResponse {
  sent: true;
  /** Masked destination, e.g. "s•••@example.com" or "+91 •••••• 3210". */
  destination: string;
  resendAvailableInSeconds: number;
}

// Fixed user-facing messages.
export const AUTH_MESSAGES = {
  loginFailed: 'Incorrect email or password.',
  accountLocked: 'Too many incorrect attempts. Try again in 30 minutes, or reset your password.',
  emailNotVerified: 'Verify your email address before logging in.',
  registrationPending:
    'Your account is not created yet: verify your email first. Sign up again with this email to get a new code.',
  emailAlreadyRegistered: 'An account with this email already exists. Log in instead.',
  emailNotRegistered: 'Email not registered.',
  notInvited: 'StyleMe is in a closed beta. Registration is by invitation only for now.',
  otpInvalid: 'That code is incorrect or has expired.',
  otpLocked: 'Too many incorrect codes. Try again in 30 minutes.',
  linkInvalid: 'This link is invalid, has expired or has already been used.',
  resendCooldown: 'Please wait before requesting another code.',
  resendLimit: 'Too many requests. Please try again later.',
  resetTokenInvalid: 'This reset link or code is invalid or has expired.',
  passwordIncorrect: 'The password you entered is incorrect.',
  passwordSetupRequired: 'Create your StyleMe password to continue.',
  googleAccountExists: 'This email already has a StyleMe account. Log in instead.',
  googleNoAccount: 'There is no StyleMe account for this Google email yet. Sign up first.',
  googleNotVerified: 'Google has not verified this email address.',
} as const;

// Headers the Next.js server (BFF) sends so the API can rate-limit per end-user IP. The client-IP
// header is trusted only together with the shared BFF secret (SECURITY.md §5).
export const BFF_KEY_HEADER = 'x-styleme-bff-key';
export const CLIENT_IP_HEADER = 'x-styleme-client-ip';

/** Versions of the legal documents a user accepts at sign-up (recorded with the consent timestamp). */
export const LEGAL_VERSIONS = { terms: '2026-10-12-draft', privacy: '2026-10-12-draft' } as const;
