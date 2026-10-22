import { z } from 'zod';
import { objectIdSchema } from './common';
import { bodyTypeSchema } from './my-profile';

// Profile photos, photo-analysis consent and appearance analyses (FRD §4.3a FR-MYP-07 … 12,
// DATABASE.md §3.7 – §3.8, decisions D-103, D-122 and D-129). Founder decision 2026-10-22 (D-129): a face
// photo (skin tone and undertone) and full-body photos (body type) are analysed by Gemini through
// `apps/api/src/integrations/ai/`, live whenever the API has a Gemini key, after the user agrees to the
// photo notice. Photos are stored privately in MongoDB until the user deletes them or their account.

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
export const photoContentTypeSchema = z.enum(PHOTO_CONTENT_TYPES);
export type PhotoContentType = z.infer<typeof photoContentTypeSchema>;
/** The web app shrinks photos before upload; the API refuses anything larger. */
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/** Version of the photo notice the user agrees to before an analysis; bump it when the wording changes. */
export const PHOTO_NOTICE_VERSION = '2026-10-22.2';

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

export const photoQualityIssueSchema = z.enum(PHOTO_QUALITY_ISSUES);
export type PhotoQualityIssue = z.infer<typeof photoQualityIssueSchema>;

/** What the user is told when a photo can't be analysed. */
export const PHOTO_QUALITY_MESSAGES: Record<PhotoQualityIssue, string> = {
  too_dark: 'The photo is too dark. Try again in even daylight, facing a window.',
  too_bright: 'The photo is too bright or washed out. Avoid direct sun and flash.',
  blurry: 'The photo is blurry. Hold the camera steady and try again.',
  face_not_found: 'We could not see a face clearly. Use a front-facing photo without filters.',
  body_not_fully_visible: 'We could not see your whole body. Stand back so you are visible from head to feet.',
  multiple_people: 'More than one person is in the photo. Use a photo of just you.',
};

// --- Upload and analysis (`POST /v1/photos`) -------------------------------------------------------

/**
 * Query of `POST /v1/photos` (the body is the raw image). `notice` must equal `PHOTO_NOTICE_VERSION`: the
 * user agreed to the photo notice. Body photos are full-body, front view.
 */
export const uploadPhotoQuerySchema = z
  .object({ kind: photoKindSchema, notice: z.literal(PHOTO_NOTICE_VERSION) })
  .strict();
export type UploadPhotoQuery = z.infer<typeof uploadPhotoQuerySchema>;

/** Validated Gemini output for a face photo (only the listed Monk tones and undertones are allowed). */
export const faceAnalysisResultSchema = z
  .object({
    monkTone: z.number().int().min(1).max(10),
    undertone: z.enum(['warm', 'cool', 'neutral', 'olive']),
  })
  .strict();
export type FaceAnalysisResult = z.infer<typeof faceAnalysisResultSchema>;

/** Validated Gemini output for a full-body photo; the body type must belong to the Clothing Preference. */
export const bodyAnalysisResultSchema = z.object({ bodyType: bodyTypeSchema }).strict();
export type BodyAnalysisResult = z.infer<typeof bodyAnalysisResultSchema>;

export type ConfidenceLabel = z.infer<typeof confidenceLabelSchema>;
export type AnalysisStatus = z.infer<typeof analysisStatusSchema>;

/** One analysis, as returned to its owner. */
export interface AppearanceAnalysisSummary {
  id: string;
  kind: z.infer<typeof analysisKindSchema>;
  source: z.infer<typeof analysisSourceSchema>;
  result: FaceAnalysisResult | BodyAnalysisResult;
  confidence: ConfidenceLabel | null;
  status: AnalysisStatus;
  createdAt: string;
}

/** `GET /v1/photos`: the user's own photos (metadata only) and whether photo analysis is available. */
export interface PhotosResponse {
  photos: UserPhoto[];
  analysisAvailable: boolean;
}
