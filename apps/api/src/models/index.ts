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
import { manualStepSchema, type ManualStepDoc } from './manual';
import {
  designFeatureCategorySchema,
  designFeatureSchema,
  featureCombinationSchema,
  featureSuitabilityRuleSchema,
  outfitCategorySchema,
  userDesignPreferenceSchema,
  userDesignSelectionSchema,
} from './design';
import {
  colourCategorySchema,
  colourSwatchSchema,
  userColourCombinationSchema,
  userColourPreferenceSchema,
} from './colours';

// Stage 1 account collections (DATABASE.md §3.1 – §3.1d). Collection names are explicit so they
// match the documentation and the tombstone replay list.

/**
 * Test fixture marker (issue #52, D-78).
 * Set to `true` on fixture documents in local, CI and staging test data.
 * Refused in production by assertNoFixtureDocuments at startup.
 */
export const fixtureField = {
  isFixture: { type: Boolean, default: undefined },
} as const;

const userSchema = new Schema(
  {
    ...fixtureField,
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
  ...fixtureField,
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
    ...fixtureField,
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
    ...fixtureField,
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
  ...fixtureField,
  sidHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  // Remember Me (D-91): 30 days; otherwise a browser-session cookie with a 24-hour server limit.
  remember: { type: Boolean, default: false },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

// Lives in the separate tombstone store, outside the main database's restore scope (D-85).
const tombstoneSchema = new Schema({
  ...fixtureField,
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  emailHmac: { type: String, required: true, index: true },
  deletedAt: { type: Date, required: true },
  source: { type: String, enum: ['self_service', 'admin_request'], required: true },
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

// Appearance (DATABASE.md §3.3 and §5, D-129). Each attribute keeps the value used for recommendations
// and where it came from: the user's choice, a photo estimate (Gemini), the user's measurements, or the
// user's correction. Photo and measurement results are stored at once with `userConfirmed: false` until
// the user reviews them; `estimate` then points at the analysis (`{ analysisId, confidence }`).
// `null` means the attribute isn't set.
const appearanceAttributeSchema = new Schema(
  {
    value: { type: Schema.Types.Mixed, required: true },
    source: {
      type: String,
      enum: ['self_reported', 'photo_estimate', 'measurements', 'user_corrected'],
      required: true,
    },
    userConfirmed: { type: Boolean, required: true },
    confirmedAt: { type: Date, default: null },
    estimate: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const appearanceProfileSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    skinTone: { type: appearanceAttributeSchema, default: null },
    undertone: { type: appearanceAttributeSchema, default: null },
    bodyProportions: { type: appearanceAttributeSchema, default: null },
    // Body type (D-129): one of BODY_TYPES_BY_DEPARTMENT; setting it also sets `bodyProportions`.
    bodyType: { type: appearanceAttributeSchema, default: null },
    // Signals are used only while this is on (FR-SIG-03).
    useInRecommendations: { type: Boolean, default: true, required: true },
    // Prompt version of the latest photo analysis (D-129).
    analysisVersion: { type: String, default: null },
    // Consent per photo kind (D-129): recorded with each upload; `noticeVersion` is the notice the user agreed to.
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

// Private profile photos (DATABASE.md §3.7, D-103, D-129). The image bytes are stored here in MongoDB
// (`data`, never selected by default and never returned to clients or logged), so deleting the account
// deletes the photo with this document. Two separate uploads: `face` (skin tone and undertone) and `body`
// (full-body front view, body type; kept for the later 2D/3D try-on). `storageKey` is for a future object
// store (D-107) and is unset while photos live in MongoDB.
const userPhotoSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ['face', 'body'], required: true },
    angle: { type: String, enum: ['front', 'side', 'back'], default: null },
    storage: { type: String, enum: ['mongodb', 'object_storage'], default: 'mongodb', required: true },
    // Mixed (stored as BSON binary): the bytes go only to the analysis provider and back to their owner.
    data: { type: Schema.Types.Mixed, select: false },
    storageKey: { type: String, default: undefined },
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
// Named, so it never clashes with the old non-partial `storageKey_1` (dropped by migration 002).
userPhotoSchema.index(
  { storageKey: 1 },
  { name: 'storageKey_when_set', unique: true, partialFilterExpression: { storageKey: { $type: 'string' } } },
);

// Design Studio designs (D-134, DATABASE.md §4e). The user's sketch (`sourceImage`) and the generated
// picture (`image`) are stored here as BSON binary, never selected by default and never logged, so deleting
// the design or the account deletes them with it. `imagePrompt` is Gemini's garment-only prompt, kept so the
// picture can be generated again; it is the only thing the image services receive.
const designImageSchema = new Schema(
  { data: { type: Schema.Types.Mixed, required: true }, contentType: { type: String, required: true } },
  { _id: false },
);
const designSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true },
    source: { type: String, enum: ['sketch', 'upload', 'description', 'look'], required: true },
    description: { type: String, default: '' },
    lookId: { type: Schema.Types.ObjectId, default: null },
    slotId: { type: String, default: null },
    sourceImage: { type: designImageSchema, default: null, select: false },
    image: { type: designImageSchema, default: null, select: false },
    imageStatus: { type: String, enum: ['ready', 'failed'], required: true },
    imageProvider: { type: String, enum: ['pollinations', 'cloudflare'], default: null },
    imagePrompt: { type: String, required: true, select: false },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    tailorSpec: { type: Schema.Types.Mixed, required: true },
    analysisModel: { type: String, required: true },
    promptVersion: { type: String, required: true },
    noticeVersion: { type: String, required: true },
  },
  { timestamps: true },
);
designSchema.index({ userId: 1, createdAt: -1 });

// Style Assistant conversations (D-136, DATABASE.md §4f). Messages are embedded (at most CHAT_MESSAGE_LIMIT);
// cards are snapshots of the user's own looks, colours and designs (no image bytes). Never logged.
const chatMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    text: { type: String, required: true },
    intent: { type: String, default: null },
    cards: { type: [Schema.Types.Mixed], default: [] },
    links: { type: [Schema.Types.Mixed], default: [] },
    wording: { type: String, enum: ['ai', 'fixed', null], default: null },
    createdAt: { type: Date, required: true },
  },
  { _id: true },
);
const chatConversationSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    messages: { type: [chatMessageSchema], default: [] },
  },
  { timestamps: true },
);
chatConversationSchema.index({ userId: 1, updatedAt: -1 });

// History of appearance analyses (DATABASE.md §3.8, D-103, D-129): photo analyses by Gemini and body types
// identified from measurements. The value in use lives in `appearanceProfiles`; a new result is applied
// there at once (unconfirmed) and the user confirms or corrects it. Deleting a photo does not delete
// results derived from it (they are deleted separately).
const appearanceAnalysisSchema = new Schema(
  {
    ...fixtureField,
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
// (`updateProfileRequestSchema`) before they reach the database.
const profileSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    // The Clothing Preference (D-129): `women` or `men`. `any` remains only on profiles saved before D-129.
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
    // My Profile fields (DATABASE.md §3.2, D-102 … D-104, D-129). `default: undefined` keeps existing
    // documents unchanged, so no migration is needed.
    ageGroup: { type: String, enum: ['under_18', '18_24', '25_34', '35_44', '45_plus'], default: undefined },
    // Height in whole centimetres (D-131); unset until the user gives it.
    heightCm: { type: Number, min: 120, max: 230, default: undefined },
    // 3D Virtual Try-On model preference: 'custom_photo' or 'dummy_model'
    tryOnModel: { type: String, enum: ['custom_photo', 'dummy_model'], default: 'dummy_model' },
    // Body measurements entered by the user, stored in cm (`{ displayUnit, valuesCm, updatedAt }`, D-129):
    // body-type measurements and optional fit measurements for the user's Clothing Preference.
    measurements: { type: Schema.Types.Mixed, default: undefined },
    // Unused since D-129 (the body type lives in `appearanceProfiles.bodyType`); kept for existing documents.
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
    ...fixtureField,
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
    // `{ level, differs }` when the look was requested around a designed garment (D-132); null otherwise.
    designMatch: { type: Schema.Types.Mixed, default: null },
    // The feature the look was created in (#115); migration 003 fills it on looks made before it existed.
    source: { type: String, enum: ['discover_my_style'], default: 'discover_my_style' },
    // Products the user picked on Shop My Look (#120), one per garment: `lookPickSchema`, from search results.
    shopPicks: { type: [Schema.Types.Mixed], default: [] },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);
outfitSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Shop My Look tabs: the user's saved looks from Discover My Style, newest first (#115).
outfitSchema.index({ userId: 1, status: 1, source: 1, createdAt: -1 });
// Suggested looks expire 7 days after creation (D-23); saved looks have no `expiresAt`.
outfitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// The AI outfit image of one look, generated on first view and stored here with the look's lifetime: it
// expires with a suggested look and is kept (no `expiresAt`) once the look is saved. The bytes (`data`) are
// never selected by default and never logged. The prompt held only garments, colours and the occasion.
const outfitImageSchema = new Schema(
  {
    ...fixtureField,
    userId: { type: Schema.Types.ObjectId, required: true },
    outfitId: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, select: false },
    contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
    bytes: { type: Number, required: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
outfitImageSchema.index({ outfitId: 1 }, { unique: true });
outfitImageSchema.index({ userId: 1 });
outfitImageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Items the user found elsewhere (DATABASE.md §3.6, D-77 = B, D-80). Everything is the user's own entry:
// nothing is verified, and there is no retailer, stock, rating, image or quality field (FR-LIST-03).
// Items are never edited (delete and re-add), so only `createdAt` is kept. `outfitId` and `slotId` are
// set together (an item attached to one slot of a saved look) or both null.
const shortlistItemSchema = new Schema(
  {
    ...fixtureField,
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
    ...fixtureField,
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

// Store search listings for Shop My Look price ranges (#118), reused for a day. System data: the key is a
// hash of the query (a garment's search phrase and the department), with no user ID, so it is not
// user-owned. Only the store and the parsed price of each Amazon, Flipkart or Meesho listing are kept.
const priceSearchCacheSchema = new Schema(
  {
    ...fixtureField,
    cacheKey: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    // `[{ store: "amazon" | "flipkart" | "meesho", price }]`
    listings: { type: [Schema.Types.Mixed], default: [] },
    checkedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false },
);
priceSearchCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export type PriceSearchCacheDoc = InferSchemaType<typeof priceSearchCacheSchema>;
export type BetaInviteDoc = InferSchemaType<typeof betaInviteSchema>;
export type PendingRegistrationDoc = InferSchemaType<typeof pendingRegistrationSchema>;
export type AuthChallengeDoc = InferSchemaType<typeof authChallengeSchema>;
export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export type TombstoneDoc = InferSchemaType<typeof tombstoneSchema>;
export type AppearanceProfileDoc = InferSchemaType<typeof appearanceProfileSchema>;
export type ProfileDoc = InferSchemaType<typeof profileSchema>;
export type OutfitDoc = InferSchemaType<typeof outfitSchema>;
export type OutfitImageDoc = InferSchemaType<typeof outfitImageSchema>;
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
export type DesignFeatureDoc = InferSchemaType<typeof designFeatureSchema>;
export type FeatureSuitabilityRuleDoc = InferSchemaType<typeof featureSuitabilityRuleSchema>;
export type UserDesignPreferenceDoc = InferSchemaType<typeof userDesignPreferenceSchema>;
export type UserDesignSelectionDoc = InferSchemaType<typeof userDesignSelectionSchema>;
export type DesignDoc = InferSchemaType<typeof designSchema>;
export type ChatConversationDoc = InferSchemaType<typeof chatConversationSchema>;

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
  OutfitImage: Model<OutfitImageDoc>;
  ShortlistItem: Model<ShortlistItemDoc>;
  AiCache: Model<AiCacheDoc>;
  PriceSearchCache: Model<PriceSearchCacheDoc>;
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
  ManualStep: Model<ManualStepDoc>;
  // Design features (D-132).
  OutfitCategory: Model<InferSchemaType<typeof outfitCategorySchema>>;
  DesignFeatureCategory: Model<InferSchemaType<typeof designFeatureCategorySchema>>;
  DesignFeature: Model<DesignFeatureDoc>;
  FeatureSuitabilityRule: Model<FeatureSuitabilityRuleDoc>;
  FeatureCombination: Model<InferSchemaType<typeof featureCombinationSchema>>;
  UserDesignPreference: Model<UserDesignPreferenceDoc>;
  UserDesignSelection: Model<UserDesignSelectionDoc>;
  // Colour library (D-133).
  ColourSwatch: Model<InferSchemaType<typeof colourSwatchSchema>>;
  ColourCategory: Model<InferSchemaType<typeof colourCategorySchema>>;
  UserColourPreference: Model<InferSchemaType<typeof userColourPreferenceSchema>>;
  UserColourCombination: Model<InferSchemaType<typeof userColourCombinationSchema>>;
  // Design Studio (D-134).
  Design: Model<DesignDoc>;
  // Style Assistant (D-136).
  ChatConversation: Model<ChatConversationDoc>;
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
    OutfitImage: main.model('OutfitImage', outfitImageSchema, 'outfitImages'),
    ShortlistItem: main.model('ShortlistItem', shortlistItemSchema, 'shortlistItems'),
    AiCache: main.model('AiCache', aiCacheSchema, 'aiCache'),
    PriceSearchCache: main.model('PriceSearchCache', priceSearchCacheSchema, 'priceSearchCache'),
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
    ManualStep: main.model('ManualStep', manualStepSchema, 'manualSteps'),
    OutfitCategory: main.model('OutfitCategory', outfitCategorySchema, 'outfitCategories'),
    DesignFeatureCategory: main.model('DesignFeatureCategory', designFeatureCategorySchema, 'designFeatureCategories'),
    DesignFeature: main.model('DesignFeature', designFeatureSchema, 'designFeatures'),
    FeatureSuitabilityRule: main.model(
      'FeatureSuitabilityRule',
      featureSuitabilityRuleSchema,
      'featureSuitabilityRules',
    ),
    FeatureCombination: main.model('FeatureCombination', featureCombinationSchema, 'featureCombinations'),
    UserDesignPreference: main.model('UserDesignPreference', userDesignPreferenceSchema, 'userDesignPreferences'),
    UserDesignSelection: main.model('UserDesignSelection', userDesignSelectionSchema, 'userDesignSelections'),
    ColourSwatch: main.model('ColourSwatch', colourSwatchSchema, 'colourSwatches'),
    ColourCategory: main.model('ColourCategory', colourCategorySchema, 'colourCategories'),
    UserColourPreference: main.model('UserColourPreference', userColourPreferenceSchema, 'userColourPreferences'),
    UserColourCombination: main.model('UserColourCombination', userColourCombinationSchema, 'userColourCombinations'),
    Design: main.model('Design', designSchema, 'designs'),
    ChatConversation: main.model('ChatConversation', chatConversationSchema, 'chatConversations'),
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
  // My Profile collections (D-103, D-129). Photo bytes are stored in `userPhotos` itself, so they go with it.
  'userPhotos',
  'appearanceAnalyses',
  'outfits',
  // AI outfit images, one per look; the bytes are stored in the document, so they go with it.
  'outfitImages',
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
  // Design features (D-132, DATABASE.md §4c).
  'userDesignPreferences',
  'userDesignSelections',
  // Colour library (D-133, DATABASE.md §4d).
  'userColourPreferences',
  'userColourCombinations',
  // Design Studio (D-134, DATABASE.md §4e). Sketches and generated pictures are stored in `designs` itself.
  'designs',
  // Style Assistant (D-136, DATABASE.md §4f).
  'chatConversations',
] as const;
