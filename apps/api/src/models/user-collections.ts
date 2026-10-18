import { Schema } from 'mongoose';
import {
  ADMIN_ROLES,
  ADMIN_STATUSES,
  AUDIT_ACTIONS,
  AUDIT_STATUSES,
  AUDIT_TARGET_TYPES,
  PALETTE_COLOUR_ROLES,
  SAVED_ITEM_TYPE_IDS,
  SAVED_REF_KINDS,
  STYLEME_FEATURES,
  USER_FEEDBACK_REASON_IDS,
  USER_FEEDBACK_TARGET_TYPES,
  USER_FEEDBACK_VALUES,
} from '@styleme/contracts';

// User-owned collections for Saved Outfits, My Colour Palette and feedback (DATABASE.md §3.10 – §3.13), and
// the admin collections (DATABASE.md §4b). SPECIFIED 2026-10-18 (D-115, D-116, D-120) — no endpoint uses
// them yet. Every user-owned one is keyed by `userId` and listed in USER_OWNED_COLLECTIONS.

// --- Saved items: one save system for every feature (D-116) ---------------------------------------------

export const savedItemSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    itemType: { type: String, enum: SAVED_ITEM_TYPE_IDS, required: true },
    sourceFeature: { type: String, enum: STYLEME_FEATURES, required: true },
    /** What it points at; shared records by stable ID, never copied. */
    ref: {
      type: new Schema(
        { kind: { type: String, enum: SAVED_REF_KINDS, required: true }, id: { type: String, default: null } },
        { _id: false },
      ),
      required: true,
    },
    /**
     * Duplicate detection: hash of the reference plus the user's customisation. Saving the same thing twice
     * finds the existing item; a deliberately customised variation gets a different key (FR-SAVE-05).
     */
    identityKey: { type: String, required: true },
    name: { type: String, required: true },
    notes: { type: String, default: '' },
    isFavourite: { type: Boolean, default: false },
    collectionIds: { type: [Schema.Types.ObjectId], default: [] },
    /** Type-specific choices (colours, garment selection, try-on configuration), validated by Zod. */
    customization: { type: Schema.Types.Mixed, default: null },
    /**
     * Permitted snapshot so the item stays understandable if its source is retired: names, attributes,
     * swatches, illustration IDs; for products the price *as captured*, always shown as historical.
     */
    snapshot: { type: Schema.Types.Mixed, default: null },
    /** Why it was originally recommended (explanation and rule IDs), when there was a recommendation. */
    recommendationContext: { type: Schema.Types.Mixed, default: null },
    /** Where the inspiration came from (palette, design, template, styles), so it can be reopened. */
    origin: {
      type: new Schema(
        {
          paletteId: { type: String, default: null },
          customPaletteId: { type: Schema.Types.ObjectId, default: null },
          templateId: { type: String, default: null },
          designId: { type: Schema.Types.ObjectId, default: null },
          clothingStyleIds: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    /** Filter facets copied at save time (occasion, category, style, colours). */
    facets: {
      type: new Schema(
        {
          occasions: { type: [String], default: [] },
          categories: { type: [String], default: [] },
          styles: { type: [String], default: [] },
          colorIds: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    coverIllustrationId: { type: String, default: null },
    /** Set by Duplicate or Save as New Look: the saved item this one was derived from. */
    derivedFromId: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, minimize: false },
);
savedItemSchema.index({ userId: 1, identityKey: 1 }, { unique: true });
savedItemSchema.index({ userId: 1, itemType: 1, createdAt: -1 });
savedItemSchema.index({ userId: 1, updatedAt: -1 });
savedItemSchema.index({ userId: 1, collectionIds: 1 });
savedItemSchema.index({ userId: 1, isFavourite: 1 });
// Reverse lookup for "is this saved?" indicators on source cards.
savedItemSchema.index({ userId: 1, 'ref.kind': 1, 'ref.id': 1 });

/** Named collections; an item may belong to several without being duplicated (FR-SAVE-09). */
export const savedCollectionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    /** Lower-cased name, for the per-user uniqueness check. */
    nameKey: { type: String, required: true },
  },
  { timestamps: true },
);
savedCollectionSchema.index({ userId: 1, nameKey: 1 }, { unique: true });

// --- Custom palettes: a personal copy; the curated original never changes (FR-PAL-13) -------------------

export const customPaletteSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    colours: {
      type: [
        new Schema(
          {
            hex: { type: String, required: true, match: /^#[0-9A-F]{6}$/ },
            name: { type: String, default: null },
            role: { type: String, enum: PALETTE_COLOUR_ROLES, required: true },
          },
          { _id: false },
        ),
      ],
      validate: [(v: unknown[]) => v.length >= 2 && v.length <= 12, 'A palette has 2 to 12 colours'],
    },
    basedOnPaletteId: { type: String, default: null },
  },
  { timestamps: true },
);
customPaletteSchema.index({ userId: 1, updatedAt: -1 });

// --- Explicit feedback (D-115) -------------------------------------------------------------------------

/**
 * One current reaction per user and target; changing it overwrites, undo deletes it. Looks keep their own
 * `outfits.feedback` (FR-OUT-04). Used for ranking only while the user's personalisation allows it.
 */
export const userFeedbackSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    targetType: { type: String, enum: USER_FEEDBACK_TARGET_TYPES, required: true },
    targetId: { type: String, required: true },
    value: { type: String, enum: USER_FEEDBACK_VALUES, required: true },
    reasons: { type: [String], enum: USER_FEEDBACK_REASON_IDS, default: [] },
    feature: { type: String, enum: STYLEME_FEATURES, required: true },
  },
  { timestamps: true },
);
userFeedbackSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
userFeedbackSchema.index({ userId: 1, updatedAt: -1 });

// --- Admin (D-120) -------------------------------------------------------------------------------------

/**
 * Admin privileges on top of an existing account (`users.role: admin`, D-95). No password or credential is
 * stored here; login uses the normal authentication.
 */
export const adminAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    role: { type: String, enum: ADMIN_ROLES, required: true },
    status: { type: String, enum: ADMIN_STATUSES, default: 'active', required: true },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
adminAccountSchema.index({ role: 1, status: 1 });

/** Sanitised record of every administrative action (SECURITY.md §2.1). Retained 1 year (TTL). */
export const adminAuditLogSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, required: true },
  action: { type: String, enum: AUDIT_ACTIONS, required: true },
  targetType: { type: String, enum: AUDIT_TARGET_TYPES, required: true },
  targetId: { type: String, required: true },
  status: { type: String, enum: AUDIT_STATUSES, required: true },
  /** Field names and non-personal catalogue values only (`auditChangeSchema`). */
  changes: { type: Schema.Types.Mixed, default: [] },
  requestId: { type: String, default: null },
  at: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});
adminAuditLogSchema.index({ at: -1 });
adminAuditLogSchema.index({ adminId: 1, at: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1, at: -1 });
adminAuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
