import { Schema, type Connection, type InferSchemaType, type Model } from 'mongoose';
import {
  catalogueCategorySchema,
  clothingStyleSchema,
  fabricRuleSchema,
  garmentAttributeSchema,
  illustrationSchema,
  outfitTemplateSchema,
  paletteSchema,
  stylingRuleSchema,
  usageDailyStatSchema,
} from './catalogue';
import {
  adminAccountSchema,
  adminAuditLogSchema,
  customPaletteSchema,
  savedCollectionSchema,
  savedItemSchema,
  userFeedbackSchema,
} from './user-collections';

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
    // SPECIFIED (D-120, D-125); nothing writes these yet. Day of the last authenticated request (updated at
    // most once a day) for aggregate "active users" counts, and who suspended the account through the
    // admin panel. `default: undefined` leaves existing documents unchanged.
    lastActiveAt: { type: Date, default: undefined },
    suspension: {
      type: new Schema({ suspendedAt: Date, suspendedBy: Schema.Types.ObjectId, reasonCode: String }, { _id: false }),
      default: undefined,
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
    // Photo-analysis estimates only (D-103, approved, not built).
    analysisVersion: { type: String, default: null },
    // Approved (D-103), not built: no endpoint writes these yet. Consent per photo kind,
    // asked before the first analysis and revocable; `noticeVersion` is the disclosure the user saw.
    photoConsent: {
      type: new Schema(
        {
          face: {
            type: new Schema(
              { noticeVersion: String, grantedAt: Date, revokedAt: { type: Date, default: null } },
              { _id: false },
            ),
            default: undefined,
          },
          body: {
            type: new Schema(
              { noticeVersion: String, grantedAt: Date, revokedAt: { type: Date, default: null } },
              { _id: false },
            ),
            default: undefined,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
    // Keep photos until deleted, or delete them automatically after analysis (user's choice).
    photoRetention: { type: String, enum: ['keep', 'delete_after_analysis'], default: undefined },
  },
  { timestamps: true },
);

// Approved, not built (DATABASE.md §3.7, D-103): metadata of private profile photos. The image itself lives in
// private object storage under `storageKey`; it is never public and never returned to clients. Two
// separate uploads: `face` (skin tone and undertone) and `body` (front/side/back, body shape). Before any
// upload endpoint ships, account deletion must also delete the stored objects, not only this metadata.
const userPhotoSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['face', 'body'], required: true },
    angle: { type: String, enum: ['front', 'side', 'back'], default: null },
    storageKey: { type: String, required: true, unique: true },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    bytes: { type: Number, required: true },
    retention: { type: String, enum: ['keep', 'delete_after_analysis'], required: true },
    uploadedAt: { type: Date, required: true },
    analyzedAt: { type: Date, default: null },
    // Set for `delete_after_analysis`; a deletion job removes the object and this document together.
    deleteAfter: { type: Date, default: null },
  },
  { timestamps: true },
);
userPhotoSchema.index({ userId: 1, kind: 1, uploadedAt: -1 });
userPhotoSchema.index({ deleteAfter: 1 }, { partialFilterExpression: { deleteAfter: { $type: 'date' } } });

// Approved, not built (DATABASE.md §3.8, D-103): history of appearance analyses. The value in use stays in
// `appearanceProfiles`; a result is applied there only after the user confirms or corrects it.
// Deleting a photo does not delete results derived from it (they are deleted separately).
const appearanceAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['skin_tone', 'body_shape'], required: true },
    source: { type: String, enum: ['photo', 'measurements', 'photo_and_measurements'], required: true },
    photoIds: { type: [Schema.Types.ObjectId], default: [] },
    result: { type: Schema.Types.Mixed, required: true },
    // High / medium / low for photo-only results; null otherwise (never presented as certain).
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: null },
    status: {
      type: String,
      enum: ['pending_review', 'confirmed', 'corrected', 'superseded'],
      default: 'pending_review',
      required: true,
    },
    analysisVersion: { type: String, required: true },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
appearanceAnalysisSchema.index({ userId: 1, kind: 1, createdAt: -1 });
appearanceAnalysisSchema.index({ userId: 1, source: 1 });

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
    // My Profile fields (DATABASE.md §3.2, D-102 … D-104, approved 2026-10-18, not built). The profile
    // contract does not accept them yet and responses never include them; `default: undefined` keeps
    // existing documents unchanged, so no migration is needed.
    ageGroup: { type: String, enum: ['under_18', '18_24', '25_34', '35_44', '45_plus'], default: undefined },
    // Body measurements, entered manually, stored in cm (`{ displayUnit, valuesCm, updatedAt }`).
    measurements: { type: Schema.Types.Mixed, default: undefined },
    // Manual body-shape choice (a proportion descriptor or "not_sure") when no analysis is used.
    bodyShapeChoice: { type: String, default: undefined },
    defaultFit: { type: String, default: undefined },
    categoryBudgets: { type: Schema.Types.Mixed, default: undefined },
    customOccasions: { type: [String], default: undefined },
    // Last-updated date per My Profile section (`{ basic_info: Date, … }`).
    sectionUpdatedAt: { type: Schema.Types.Mixed, default: undefined },
    // SPECIFIED feature fields (DATABASE.md §3.2, D-111, D-115); the profile contract does not accept them
    // yet. Styling goals (Outfit Categories), preferred and avoided clothing styles (CST IDs), and the
    // user's personalisation controls: pause, whether feedback is used, and the last reset.
    stylingGoals: { type: [String], default: undefined },
    preferredStyleIds: { type: [String], default: undefined },
    avoidedStyleIds: { type: [String], default: undefined },
    personalization: {
      type: new Schema({ paused: Boolean, useFeedback: Boolean, resetAt: Date }, { _id: false }),
      default: undefined,
    },
  },
  { timestamps: true, minimize: false },
);

// Looks (DATABASE.md §3.4). `POST /v1/recommendations` stores each look as `status: "suggested"` with a
// 7-day expiry; saving (#41) sets `status: "saved"` and clears `expiresAt`. Slots, explanation and
// references are a snapshot, so a look stays readable after the library changes. Validated by the
// `lookSchema` contract before it is returned; never logged.
const outfitSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    recommendationId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ['suggested', 'saved'], required: true },
    templateId: { type: String, required: true },
    paletteId: { type: String, required: true },
    // `{ slotId, slot, lookSpec, swatches, searchPhrase, sizeNote, alternatives }` per slot.
    slots: { type: [Schema.Types.Mixed], required: true },
    explanation: { type: String, required: true },
    explanationRefs: { type: Schema.Types.Mixed, required: true },
    combinationSignature: { type: String, required: true },
    // Knowledge-base content version the look was generated from (same input + version = same looks).
    contentVersion: { type: String, required: true },
    // Snapshot of the request and of the profile inputs used, so regenerate (#49) can show what changed.
    // Whether signals were used is stored; their values are not.
    request: { type: Schema.Types.Mixed, required: true },
    inputsUsed: { type: Schema.Types.Mixed, required: true },
    defaultsApplied: { type: [String], default: [] },
    conflicts: { type: [Schema.Types.Mixed], default: [] },
    warnings: { type: [String], default: [] },
    aiModel: { type: String, default: null },
    // Prompt version used when AI wording reworded the explanation (D-67, #55); null otherwise.
    aiPromptVersion: { type: String, default: null },
    // FR-OUT-04 `{ value, reason?, at }`; written by #42.
    feedback: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
outfitSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Suggested looks expire 7 days after creation (D-23); saved looks have no `expiresAt`.
outfitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Items the user found elsewhere (DATABASE.md §3.6, D-77 = B, D-80). Everything is the user's own entry:
// nothing is verified, and there is no retailer, stock, rating, image or quality field (FR-LIST-03).
// Items are never edited (delete and re-add), so only `createdAt` is kept. `outfitId` and `slotId` are
// set together (an item attached to one slot of a saved look) or both null.
const shortlistItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    outfitId: { type: Schema.Types.ObjectId, default: null },
    slotId: { type: String, default: null },
    name: { type: String, required: true },
    // Stored exactly as entered; never fetched, previewed or modified (FR-LIST-05).
    url: { type: String, default: null },
    priceEntered: { type: Number, required: true },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    priceBasis: { type: String, enum: ['user_entered'], default: 'user_entered' },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
shortlistItemSchema.index({ userId: 1, createdAt: -1 });
// At most one item per slot of a look (D-82). Partial, so unattached items never conflict.
shortlistItemSchema.index(
  { outfitId: 1, slotId: 1 },
  { unique: true, partialFilterExpression: { outfitId: { $type: 'objectId' } } },
);

// Cached optional AI wording (DATABASE.md §3.5, D-13). System data: the key and the response come from
// rule references and attribute labels only, never personal data (AI rule 16), so it is not user-owned.
const aiCacheSchema = new Schema(
  {
    cacheKey: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    requestType: { type: String, required: true },
    // The validated output, e.g. `{ text, promptVersion }`.
    response: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
aiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export type BetaInviteDoc = InferSchemaType<typeof betaInviteSchema>;
export type PendingRegistrationDoc = InferSchemaType<typeof pendingRegistrationSchema>;
export type AuthChallengeDoc = InferSchemaType<typeof authChallengeSchema>;
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export type TombstoneDoc = InferSchemaType<typeof tombstoneSchema>;
export type AppearanceProfileDoc = InferSchemaType<typeof appearanceProfileSchema>;
export type ProfileDoc = InferSchemaType<typeof profileSchema>;
export type OutfitDoc = InferSchemaType<typeof outfitSchema>;
export type ShortlistItemDoc = InferSchemaType<typeof shortlistItemSchema>;
export type AiCacheDoc = InferSchemaType<typeof aiCacheSchema>;
export type UserPhotoDoc = InferSchemaType<typeof userPhotoSchema>;
export type AppearanceAnalysisDoc = InferSchemaType<typeof appearanceAnalysisSchema>;
export type CatalogueCategoryDoc = InferSchemaType<typeof catalogueCategorySchema>;
export type GarmentAttributeDoc = InferSchemaType<typeof garmentAttributeSchema>;
export type ClothingStyleDoc = InferSchemaType<typeof clothingStyleSchema>;
export type PaletteDoc = InferSchemaType<typeof paletteSchema>;
export type OutfitTemplateDoc = InferSchemaType<typeof outfitTemplateSchema>;
export type StylingRuleDoc = InferSchemaType<typeof stylingRuleSchema>;
export type FabricRuleDoc = InferSchemaType<typeof fabricRuleSchema>;
export type IllustrationDoc = InferSchemaType<typeof illustrationSchema>;
export type UsageDailyStatDoc = InferSchemaType<typeof usageDailyStatSchema>;
export type SavedItemDoc = InferSchemaType<typeof savedItemSchema>;
export type SavedCollectionDoc = InferSchemaType<typeof savedCollectionSchema>;
export type CustomPaletteDoc = InferSchemaType<typeof customPaletteSchema>;
export type UserFeedbackDoc = InferSchemaType<typeof userFeedbackSchema>;
export type AdminAccountDoc = InferSchemaType<typeof adminAccountSchema>;
export type AdminAuditLogDoc = InferSchemaType<typeof adminAuditLogSchema>;

export interface Models {
  User: Model<UserDoc>;
  BetaInvite: Model<BetaInviteDoc>;
  PendingRegistration: Model<PendingRegistrationDoc>;
  AuthChallenge: Model<AuthChallengeDoc>;
  Session: Model<SessionDoc>;
  Tombstone: Model<TombstoneDoc>;
  AppearanceProfile: Model<AppearanceProfileDoc>;
  Profile: Model<ProfileDoc>;
  Outfit: Model<OutfitDoc>;
  ShortlistItem: Model<ShortlistItemDoc>;
  AiCache: Model<AiCacheDoc>;
  UserPhoto: Model<UserPhotoDoc>;
  AppearanceAnalysis: Model<AppearanceAnalysisDoc>;
  // Specified 2026-10-18 (D-110 … D-125); declared only — no endpoint uses them yet.
  CatalogueCategory: Model<CatalogueCategoryDoc>;
  GarmentAttribute: Model<GarmentAttributeDoc>;
  ClothingStyle: Model<ClothingStyleDoc>;
  Palette: Model<PaletteDoc>;
  OutfitTemplate: Model<OutfitTemplateDoc>;
  StylingRule: Model<StylingRuleDoc>;
  FabricRule: Model<FabricRuleDoc>;
  Illustration: Model<IllustrationDoc>;
  UsageDailyStat: Model<UsageDailyStatDoc>;
  SavedItem: Model<SavedItemDoc>;
  SavedCollection: Model<SavedCollectionDoc>;
  CustomPalette: Model<CustomPaletteDoc>;
  UserFeedback: Model<UserFeedbackDoc>;
  AdminAccount: Model<AdminAccountDoc>;
  AdminAuditLog: Model<AdminAuditLogDoc>;
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
    Outfit: main.model('Outfit', outfitSchema, 'outfits'),
    ShortlistItem: main.model('ShortlistItem', shortlistItemSchema, 'shortlistItems'),
    AiCache: main.model('AiCache', aiCacheSchema, 'aiCache'),
    UserPhoto: main.model('UserPhoto', userPhotoSchema, 'userPhotos'),
    AppearanceAnalysis: main.model('AppearanceAnalysis', appearanceAnalysisSchema, 'appearanceAnalyses'),
    CatalogueCategory: main.model('CatalogueCategory', catalogueCategorySchema, 'catalogueCategories'),
    GarmentAttribute: main.model('GarmentAttribute', garmentAttributeSchema, 'garmentAttributes'),
    ClothingStyle: main.model('ClothingStyle', clothingStyleSchema, 'clothingStyles'),
    Palette: main.model('Palette', paletteSchema, 'palettes'),
    OutfitTemplate: main.model('OutfitTemplate', outfitTemplateSchema, 'outfitTemplates'),
    StylingRule: main.model('StylingRule', stylingRuleSchema, 'stylingRules'),
    FabricRule: main.model('FabricRule', fabricRuleSchema, 'fabricRules'),
    Illustration: main.model('Illustration', illustrationSchema, 'illustrations'),
    UsageDailyStat: main.model('UsageDailyStat', usageDailyStatSchema, 'usageDailyStats'),
    SavedItem: main.model('SavedItem', savedItemSchema, 'savedItems'),
    SavedCollection: main.model('SavedCollection', savedCollectionSchema, 'savedCollections'),
    CustomPalette: main.model('CustomPalette', customPaletteSchema, 'customPalettes'),
    UserFeedback: main.model('UserFeedback', userFeedbackSchema, 'userFeedback'),
    AdminAccount: main.model('AdminAccount', adminAccountSchema, 'adminAccounts'),
    AdminAuditLog: main.model('AdminAuditLog', adminAuditLogSchema, 'adminAuditLogs'),
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
  // My Profile collections (D-103, approved, not built). Photo objects in private storage are deleted separately.
  'userPhotos',
  'appearanceAnalyses',
  'outfits',
  'shortlistItems',
  // Specified feature collections (D-115, D-116, D-120; DATABASE.md §3.10 – §3.14, §4b). `adminAccounts`
  // goes with the admin's user account; `adminAuditLogs` is a security record keyed by `adminId` and ages
  // out by TTL. `productReports` is created with the product layer.
  'savedItems',
  'savedCollections',
  'customPalettes',
  'userFeedback',
  'productReports',
  'adminAccounts',
] as const;
