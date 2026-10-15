import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';

// Stage 1 account collections (DATABASE.md §3.1 – §3.1d). Collection names are explicit so they
// match the documentation and the tombstone replay list.

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Null until a Google-registered user creates their StyleMe password (D-88).
    passwordHash: { type: String, default: null },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    isActive: { type: Boolean, default: true, required: true },
    tokenVersion: { type: Number, default: 0, required: true },
    passwordChangedAt: { type: Date, default: null },
    // Email/password accounts start unverified (FR-AUTH-16); Google sign-ups are verified by Google.
    emailVerifiedAt: { type: Date, default: null },
    // Google account subject (`sub`), unique across users (partial index below).
    googleSub: { type: String, default: undefined },
    city: { type: String, default: null },
    phone: {
      type: new Schema(
        { e164: { type: String, required: true }, verifiedAt: { type: Date, default: null } },
        { _id: false },
      ),
      default: null,
    },
    consent: {
      type: new Schema(
        {
          termsVersion: { type: String, default: null },
          termsAcceptedAt: { type: Date, default: null },
          privacyVersion: { type: String, default: null },
          privacyAcceptedAt: { type: Date, default: null },
          marketingOptIn: { type: Boolean, default: false },
          marketingUpdatedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    // Failed-login lockout (D-90): 3 wrong passwords lock the account for 30 minutes.
    loginSecurity: {
      type: new Schema(
        { failedCount: { type: Number, default: 0 }, lockedUntil: { type: Date, default: null } },
        { _id: false },
      ),
      default: () => ({}),
    },
    // Server-authoritative onboarding progress (FR-ONB).
    onboarding: {
      type: new Schema(
        {
          styleProfileCompletedAt: { type: Date, default: null },
          appearanceCompletedAt: { type: Date, default: null },
          // Set when the user chose "Skip for now" instead of setting up the style profile.
          skippedAt: { type: Date, default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
);
userSchema.index({ googleSub: 1 }, { unique: true, partialFilterExpression: { googleSub: { $type: 'string' } } });

const betaInviteSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  invitedAt: { type: Date, required: true },
  invitedBy: { type: Schema.Types.ObjectId, default: null },
  usedAt: { type: Date, default: null },
});

// A sign-up waiting for its email code (DATABASE.md §3.1e). The `users` document is created only once
// the code is verified; until then the registration lives here. `_id` is reserved as the future user's
// `_id`, so the email_verification challenge is keyed by it. Only a password hash is stored.
const pendingRegistrationSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true },
    city: { type: String, default: null },
    phone: { type: String, default: null },
    termsVersion: { type: String, required: true },
    privacyVersion: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
    marketingOptIn: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// One-time codes and links for every account flow (DATABASE.md §3.1b). One document per user and
// purpose, so issuing a new code replaces (invalidates) the previous one while attempt lockouts and
// resend history carry over. Codes and link tokens are stored only as keyed hashes.
export const CHALLENGE_PURPOSES = [
  'email_verification',
  'password_reset',
  'password_change',
  'email_change',
  'phone_verification',
  'account_deletion',
] as const;
export type ChallengePurpose = (typeof CHALLENGE_PURPOSES)[number];

const authChallengeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    purpose: { type: String, enum: CHALLENGE_PURPOSES, required: true },
    // The new email (email_change) or phone (phone_verification) being verified.
    target: { type: String, default: null },
    otpHash: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
    linkHash: { type: String, default: null },
    linkExpiresAt: { type: Date, default: null },
    consumedAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    sentAt: { type: [Date], default: [] },
    // email_verification only: proves the browser that registered (D-87), and its Remember Me choice.
    pendingTokenHash: { type: String, default: null },
    rememberMe: { type: Boolean, default: false },
    // Admin who issued an admin-assisted reset code (password_reset only), else null.
    issuedBy: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
authChallengeSchema.index({ userId: 1, purpose: 1 }, { unique: true });
authChallengeSchema.index(
  { linkHash: 1 },
  { unique: true, partialFilterExpression: { linkHash: { $type: 'string' } } },
);
authChallengeSchema.index(
  { pendingTokenHash: 1 },
  { partialFilterExpression: { pendingTokenHash: { $type: 'string' } } },
);
authChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const sessionSchema = new Schema({
  sidHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  // Remember Me (D-91): 30 days; otherwise a browser-session cookie with a 24-hour server limit.
  remember: { type: Boolean, default: false },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

// Lives in the separate tombstone store, outside the main database's restore scope (D-85).
const tombstoneSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  emailHmac: { type: String, required: true, index: true },
  deletedAt: { type: Date, required: true },
  source: { type: String, enum: ['self_service', 'admin_request'], required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

// Appearance signals (DATABASE.md §3.3 and §5). Each attribute keeps the value used for
// recommendations apart from any model estimate. Stage 1 stores only self-reported values: no
// confidence, `estimate: null`. `null` means the attribute isn't set.
const appearanceAttributeSchema = new Schema(
  {
    value: { type: Schema.Types.Mixed, required: true },
    source: { type: String, enum: ['self_reported', 'photo_estimate', 'user_corrected'], required: true },
    userConfirmed: { type: Boolean, required: true },
    confirmedAt: { type: Date, default: null },
    estimate: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const appearanceProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    skinTone: { type: appearanceAttributeSchema, default: null },
    undertone: { type: appearanceAttributeSchema, default: null },
    bodyProportions: { type: appearanceAttributeSchema, default: null },
    // Signals are used only while this is on (FR-SIG-03).
    useInRecommendations: { type: Boolean, default: true, required: true },
    // Photo-analysis estimates only (deferred, D-76).
    analysisVersion: { type: String, default: null },
  },
  { timestamps: true },
);

// Style profile (DATABASE.md §3.2), one per user. Nested values are validated by the Zod contract
// (`updateProfileRequestSchema`) before they reach the database. No age range, height or measurements
// in Stage 1 (FR-PROF-04, FR-SIZE-06).
const profileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    department: { type: String, enum: ['women', 'men', 'any'], required: true },
    sizes: { type: Schema.Types.Mixed, default: () => ({}) },
    fitPreferences: { type: Schema.Types.Mixed, default: () => ({}) },
    likedColors: { type: [String], default: [] },
    dislikedColors: { type: [String], default: [] },
    contrastPreference: { type: String, default: null },
    silhouettePreferences: { type: [String], default: [] },
    coveragePreferences: { type: Schema.Types.Mixed, default: () => ({}) },
    comfortPreferences: { type: [String], default: [] },
    fabricPreferences: { type: Schema.Types.Mixed, default: () => ({ liked: [], avoided: [] }) },
    preferredStyles: { type: [String], default: [] },
    preferredOccasions: { type: [String], default: [] },
    budgetPreference: { type: Number, default: null },
  },
  { timestamps: true, minimize: false },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export type BetaInviteDoc = InferSchemaType<typeof betaInviteSchema>;
export type PendingRegistrationDoc = InferSchemaType<typeof pendingRegistrationSchema>;
export type AuthChallengeDoc = InferSchemaType<typeof authChallengeSchema>;
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export type TombstoneDoc = InferSchemaType<typeof tombstoneSchema>;
export type AppearanceProfileDoc = InferSchemaType<typeof appearanceProfileSchema>;
export type ProfileDoc = InferSchemaType<typeof profileSchema>;

export interface Models {
  User: Model<UserDoc>;
  BetaInvite: Model<BetaInviteDoc>;
  PendingRegistration: Model<PendingRegistrationDoc>;
  AuthChallenge: Model<AuthChallengeDoc>;
  Session: Model<SessionDoc>;
  Tombstone: Model<TombstoneDoc>;
  AppearanceProfile: Model<AppearanceProfileDoc>;
  Profile: Model<ProfileDoc>;
}

export function registerModels(main: Connection, tombstones: Connection): Models {
  return {
    User: main.model('User', userSchema, 'users'),
    BetaInvite: main.model('BetaInvite', betaInviteSchema, 'betaInvites'),
    PendingRegistration: main.model('PendingRegistration', pendingRegistrationSchema, 'pendingRegistrations'),
    AuthChallenge: main.model('AuthChallenge', authChallengeSchema, 'authChallenges'),
    Session: main.model('Session', sessionSchema, 'sessions'),
    Tombstone: tombstones.model('DeletionTombstone', tombstoneSchema, 'deletionTombstones'),
    AppearanceProfile: main.model('AppearanceProfile', appearanceProfileSchema, 'appearanceProfiles'),
    Profile: main.model('Profile', profileSchema, 'profiles'),
  };
}

/**
 * Every user-owned collection, keyed by `userId` (DATABASE.md §3.1c replay list). `users` (by `_id`)
 * and `betaInvites` (by email) are handled separately. Collections that later milestones create are
 * listed already; deleting from a collection that doesn't exist yet is a no-op. Any new user-owned
 * collection must be added here before it ships (CONTRIBUTING.md §5).
 */
export const USER_OWNED_COLLECTIONS = [
  'sessions',
  'authChallenges',
  // Legacy reset tokens (before migration 001); kept so deletion and replay also clear old documents.
  'passwordResetTokens',
  'profiles',
  'appearanceProfiles',
  'outfits',
  'shortlistItems',
] as const;
