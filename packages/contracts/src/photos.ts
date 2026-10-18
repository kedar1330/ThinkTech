import { z } from 'zod';
import { objectIdSchema } from './common';

// Profile photos, photo-analysis consent and appearance analyses (FRD §4.3a FR-MYP-07 … 12,
// DATABASE.md §3.7 – §3.8, decision D-103). Approved 2026-10-18, not built: no endpoint accepts photos
// yet, and nothing ships before the privacy review. AI rule 16 applies: face photos are never sent to an
// external AI provider; full-body photos may go to Gemini only under D-122. Otherwise analysis runs on
// the user's device where feasible, or on StyleMe's own servers with disclosure and consent.

/** Two separate uploads: a face photo for skin tone and undertone, full-body photos for body shape. */
export const PHOTO_KINDS = ['face', 'body'] as const;
export const photoKindSchema = z.enum(PHOTO_KINDS);
export type PhotoKind = z.infer<typeof photoKindSchema>;

export const BODY_PHOTO_ANGLES = ['front', 'side', 'back'] as const;
export const bodyPhotoAngleSchema = z.enum(BODY_PHOTO_ANGLES);

/** The user chooses: keep photos until they delete them, or delete them automatically after analysis. */
export const PHOTO_RETENTION = ['keep', 'delete_after_analysis'] as const;
export const photoRetentionSchema = z.enum(PHOTO_RETENTION);
export type PhotoRetention = z.infer<typeof photoRetentionSchema>;

export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Photo metadata as returned to its owner. Never contains the storage key or a public URL. */
export const userPhotoSchema = z
  .object({
    id: objectIdSchema,
    kind: photoKindSchema,
    angle: bodyPhotoAngleSchema.nullable(),
    contentType: z.enum(PHOTO_CONTENT_TYPES),
    bytes: z.number().int().positive().max(PHOTO_MAX_BYTES),
    retention: photoRetentionSchema,
    uploadedAt: z.iso.datetime(),
    analyzedAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine((p) => (p.kind === 'face') === (p.angle === null), { message: 'Only body photos have an angle' });
export type UserPhoto = z.infer<typeof userPhotoSchema>;

// --- Consent (asked before the first analysis of each kind; revocable at any time) -----------------

/** What happens to existing photo-derived results when consent is revoked: the user decides. */
export const REVOKE_RESULT_CHOICES = ['keep_results', 'delete_results'] as const;

export const photoConsentRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('grant'), kind: photoKindSchema, noticeVersion: z.string().min(1) }).strict(),
  z.object({ action: z.literal('revoke'), kind: photoKindSchema, results: z.enum(REVOKE_RESULT_CHOICES) }).strict(),
]);
export type PhotoConsentRequest = z.infer<typeof photoConsentRequestSchema>;

// --- Analyses (history; the confirmed value lives in appearanceProfiles) ---------------------------

export const ANALYSIS_KINDS = ['skin_tone', 'body_shape'] as const;
export const analysisKindSchema = z.enum(ANALYSIS_KINDS);

/** Where a result came from. Measurements never come from photos (manual entry only). */
export const ANALYSIS_SOURCES = ['photo', 'measurements', 'photo_and_measurements'] as const;
export const analysisSourceSchema = z.enum(ANALYSIS_SOURCES);

/** Shown for photo-only results; measurement-informed results never claim certainty either. */
export const CONFIDENCE_LABELS = ['high', 'medium', 'low'] as const;
export const confidenceLabelSchema = z.enum(CONFIDENCE_LABELS);

/** A result is only used after the user reviews it: confirmed as is, or corrected. */
export const ANALYSIS_STATUSES = ['pending_review', 'confirmed', 'corrected', 'superseded'] as const;
export const analysisStatusSchema = z.enum(ANALYSIS_STATUSES);

/** Why a photo can't be analysed; the user is offered a retake or manual selection. */
export const PHOTO_QUALITY_ISSUES = [
  'too_dark',
  'too_bright',
  'blurry',
  'face_not_found',
  'body_not_fully_visible',
  'multiple_people',
] as const;
