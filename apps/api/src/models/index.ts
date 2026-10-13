import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';

// Stage 1 account collections (DATABASE.md §3.1 – §3.1d). Collection names are explicit so they
// match the documentation and the tombstone replay list.

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    isActive: { type: Boolean, default: true, required: true },
    tokenVersion: { type: Number, default: 0, required: true },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const betaInviteSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  invitedAt: { type: Date, required: true },
  invitedBy: { type: Schema.Types.ObjectId, default: null },
  usedAt: { type: Date, default: null },
});

const passwordResetTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ['admin_issued', 'self_service'], required: true },
  issuedBy: { type: Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  usedAt: { type: Date, default: null },
});

const sessionSchema = new Schema({
  sidHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
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
export type PasswordResetTokenDoc = InferSchemaType<typeof passwordResetTokenSchema>;
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export type TombstoneDoc = InferSchemaType<typeof tombstoneSchema>;
export type AppearanceProfileDoc = InferSchemaType<typeof appearanceProfileSchema>;
export type ProfileDoc = InferSchemaType<typeof profileSchema>;

export interface Models {
  User: Model<UserDoc>;
  BetaInvite: Model<BetaInviteDoc>;
  PasswordResetToken: Model<PasswordResetTokenDoc>;
  Session: Model<SessionDoc>;
  Tombstone: Model<TombstoneDoc>;
  AppearanceProfile: Model<AppearanceProfileDoc>;
  Profile: Model<ProfileDoc>;
}

export function registerModels(main: Connection, tombstones: Connection): Models {
  return {
    User: main.model('User', userSchema, 'users'),
    BetaInvite: main.model('BetaInvite', betaInviteSchema, 'betaInvites'),
    PasswordResetToken: main.model('PasswordResetToken', passwordResetTokenSchema, 'passwordResetTokens'),
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
  'passwordResetTokens',
  'profiles',
  'appearanceProfiles',
  'outfits',
  'shortlistItems',
] as const;
