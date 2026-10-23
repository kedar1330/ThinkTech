import { Types, mongo } from 'mongoose';
import type { Logger } from 'pino';
import {
  PHOTO_MAX_BYTES,
  PHOTO_QUALITY_MESSAGES,
  bodyAnalysisResultSchema,
  bodyTypesFor,
  confidenceLabelSchema,
  faceAnalysisResultSchema,
  photoQualityIssueSchema,
  type AppearanceAnalysisSummary,
  type BodyAnalysisResult,
  type ClothingPreference,
  type ConfidenceLabel,
  type FaceAnalysisResult,
  type PhotoAnalysisResponse,
  type PhotoContentType,
  type PhotoQualityIssue,
  type PhotosResponse,
  type UploadPhotoQuery,
  type UserPhoto,
} from '@styleme/contracts';
import { z } from 'zod';
import { PHOTO_ANALYSIS_PROMPT_VERSION } from '../integrations/ai/prompts/photo-analysis-v2';
import { VisionProviderError, type PhotoAnalysisProvider, type PhotoInput } from '../integrations/ai/vision-client';
import type { Models, UserPhotoDoc } from '../models/index';
import { AppError } from '../utils/errors';
import type { AppearanceService } from './appearance.service';

// Profile photos and their analysis by Gemini (D-129). A face photo gives skin tone and undertone; a
// full-body photo gives the body type, chosen only from the user's Clothing Preference list, and is sent
// with the height from the profile when the user gave one (D-131). The result is
// stored at once (unconfirmed) and returned with the photo, so the page shows it immediately. The newest
// photo of each kind is kept privately in MongoDB (body photos are reused for try-on); older ones are
// replaced. Photo bytes, results and model replies are never logged.

const UNAVAILABLE = 'Photo analysis is not available right now. You can choose manually instead.';
const FAILED = 'We couldn’t analyse your photo just now. Please try again, or choose manually.';

const unusableReplySchema = z.object({
  usable: z.literal(false),
  qualityIssues: z.array(z.string()).max(10).optional().default([]),
});
const usableBase = z.object({ usable: z.literal(true), confidence: confidenceLabelSchema });

/** Checks the file signature, so a renamed file of another type is refused. */
export function detectImageType(bytes: Buffer): PhotoContentType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
    return 'image/webp';
  return null;
}

function toPhoto(doc: UserPhotoDoc & { _id: Types.ObjectId }): UserPhoto {
  return {
    id: String(doc._id),
    kind: doc.kind as UserPhoto['kind'],
    angle: (doc.angle ?? null) as UserPhoto['angle'],
    contentType: doc.contentType as UserPhoto['contentType'],
    bytes: doc.bytes,
    retention: doc.retention as UserPhoto['retention'],
    uploadedAt: doc.uploadedAt.toISOString(),
    analyzedAt: doc.analyzedAt ? doc.analyzedAt.toISOString() : null,
  };
}

export class PhotoService {
  constructor(
    private readonly models: Models,
    private readonly appearance: AppearanceService,
    private readonly provider: PhotoAnalysisProvider | null,
    private readonly timeoutMs: number,
    private readonly logger: Logger,
  ) {}

  /** Whether photo analysis can run (a Gemini key is configured and the feature is on). */
  get available(): boolean {
    return this.provider !== null;
  }

  async list(userId: Types.ObjectId): Promise<PhotosResponse> {
    const docs = await this.models.UserPhoto.find({ userId }).select('-data').sort({ uploadedAt: -1 }).lean();
    return {
      photos: docs.map((d) => toPhoto(d as UserPhotoDoc & { _id: Types.ObjectId })),
      analysisAvailable: this.available,
    };
  }

  /** The image of one of the user's own photos, so My Profile can show it back to them. */
  async image(userId: Types.ObjectId, photoId: string): Promise<{ data: Buffer; contentType: string }> {
    if (!Types.ObjectId.isValid(photoId)) throw new AppError('NOT_FOUND');
    const doc = await this.models.UserPhoto.findOne({ _id: photoId, userId }).select('data contentType').lean();
    // `data` is Mixed, so it reads back as BSON Binary (or a Buffer before it reaches the database).
    const raw: unknown = doc?.data;
    const data = Buffer.isBuffer(raw) ? raw : raw instanceof mongo.Binary ? Buffer.from(raw.buffer) : null;
    if (!doc || !data?.length) throw new AppError('NOT_FOUND');
    return { data, contentType: doc.contentType };
  }

  /** Deletes one of the user's photos (results already derived from it stay until changed). */
  async remove(userId: Types.ObjectId, photoId: string): Promise<void> {
    if (!Types.ObjectId.isValid(photoId)) throw new AppError('NOT_FOUND');
    const result = await this.models.UserPhoto.deleteOne({ _id: photoId, userId });
    if (result.deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  /** Stores a full-body photo for 3D Virtual Try-On without running AI analysis on it. */
  async uploadTryOnPhoto(userId: Types.ObjectId, bytes: Buffer): Promise<UserPhoto> {
    if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) {
      throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP photo under 8 MB.');
    }
    const contentType = detectImageType(bytes);
    if (!contentType) throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP photo under 8 MB.');

    const now = new Date();
    const photo = await this.models.UserPhoto.create({
      userId,
      kind: 'body',
      angle: 'front',
      storage: 'mongodb',
      data: bytes,
      contentType,
      bytes: bytes.length,
      retention: 'keep',
      uploadedAt: now,
      analyzedAt: null,
    });
    // Keep only the newest body photo
    await this.models.UserPhoto.deleteMany({ userId, kind: 'body', _id: { $ne: photo._id } });

    // Mark 3D Virtual Try-On preference as custom_photo in the user's profile
    await this.models.Profile.updateOne({ userId }, { $set: { tryOnModel: 'custom_photo' } }, { upsert: true });

    return toPhoto(photo.toObject() as UserPhotoDoc & { _id: Types.ObjectId });
  }

  /** Stores the photo, analyses it and applies the result; everything comes back in one response. */
  async upload(userId: Types.ObjectId, query: UploadPhotoQuery, bytes: Buffer): Promise<PhotoAnalysisResponse> {
    if (!this.provider) throw new AppError('PROVIDER_NOT_CONFIGURED', UNAVAILABLE);
    if (bytes.length === 0 || bytes.length > PHOTO_MAX_BYTES) {
      throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP photo under 8 MB.');
    }
    const contentType = detectImageType(bytes);
    if (!contentType) throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP photo under 8 MB.');

    let department: ClothingPreference | null = null;
    let heightCm: number | null = null;
    if (query.kind === 'body') {
      const profile = await this.models.Profile.findOne({ userId }).lean();
      department = profile?.department === 'women' || profile?.department === 'men' ? profile.department : null;
      if (!department) throw new AppError('CONFLICT', 'Choose your clothing preference first.');
      heightCm = profile?.heightCm ?? null;
    }

    const reply = await this.callProvider(query.kind, { bytes, contentType }, department, heightCm);
    const parsed = this.parseReply(query.kind, reply, department);
    const result: FaceAnalysisResult | BodyAnalysisResult = parsed.result;
    const confidence: ConfidenceLabel = parsed.confidence;

    const now = new Date();
    const photo = await this.models.UserPhoto.create({
      userId,
      kind: query.kind,
      angle: query.kind === 'body' ? 'front' : null,
      storage: 'mongodb',
      data: bytes,
      contentType,
      bytes: bytes.length,
      retention: 'keep',
      uploadedAt: now,
      analyzedAt: now,
    });
    // Keep only the newest photo of each kind.
    await this.models.UserPhoto.deleteMany({ userId, kind: query.kind, _id: { $ne: photo._id } });

    const analysisKind = query.kind === 'face' ? 'skin_tone' : 'body_shape';
    const analysis = await this.models.AppearanceAnalysis.create({
      userId,
      kind: analysisKind,
      source: 'photo',
      photoIds: [photo._id],
      result,
      confidence,
      status: 'pending_review',
      analysisVersion: PHOTO_ANALYSIS_PROMPT_VERSION,
    });
    await this.models.AppearanceAnalysis.updateMany(
      { userId, kind: analysisKind, status: 'pending_review', _id: { $ne: analysis._id } },
      { $set: { status: 'superseded' } },
    );
    await this.models.AppearanceProfile.updateOne(
      { userId },
      {
        $set: { [`photoConsent.${query.kind}`]: { noticeVersion: query.notice, grantedAt: now, revokedAt: null } },
        $setOnInsert: { userId },
      },
      { upsert: true },
    );
    const appearance = await this.appearance.applyEstimate(userId, {
      source: 'photo_estimate',
      analysisId: analysis._id,
      confidence,
      analysisVersion: PHOTO_ANALYSIS_PROMPT_VERSION,
      values:
        'monkTone' in result
          ? { skinTone: { monkRange: `${result.monkTone}-${result.monkTone}` }, undertone: result.undertone }
          : { bodyType: result.bodyType },
    });

    const summary: AppearanceAnalysisSummary = {
      id: String(analysis._id),
      kind: analysisKind,
      source: 'photo',
      result,
      confidence,
      status: 'pending_review',
      createdAt: analysis.get('createdAt').toISOString(),
    };
    return {
      photo: toPhoto(photo.toObject() as UserPhotoDoc & { _id: Types.ObjectId }),
      analysis: summary,
      appearance,
    };
  }

  private async callProvider(
    kind: UploadPhotoQuery['kind'],
    photo: PhotoInput,
    department: ClothingPreference | null,
    heightCm: number | null,
  ): Promise<unknown> {
    const provider = this.provider!;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return kind === 'face'
        ? await provider.analyzeFace(photo, controller.signal)
        : await provider.analyzeBody(photo, department!, heightCm, controller.signal);
    } catch (err) {
      const cause = err instanceof VisionProviderError ? err.cause : 'provider_error';
      const details = err instanceof VisionProviderError ? err.details : undefined;
      this.logger.warn({
        event: 'photo_analysis_failed',
        kind,
        cause,
        details,
        provider: provider.name,
        model: provider.model,
      });
      throw new AppError(cause === 'rate_limited' ? 'RATE_LIMITED' : 'AI_UNAVAILABLE', FAILED);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Validates the reply against the contracts: only listed values, and only this Clothing Preference's body types. */
  private parseReply(kind: UploadPhotoQuery['kind'], reply: unknown, department: ClothingPreference | null) {
    const raw = (reply ?? {}) as Record<string, unknown>;

    const qualitySynonyms: Record<string, PhotoQualityIssue> = {
      underexposed: 'too_dark',
      dark: 'too_dark',
      poor_lighting: 'too_dark',
      overexposed: 'too_bright',
      bright: 'too_bright',
      washed_out: 'too_bright',
      unclear: 'blurry',
      blurred: 'blurry',
      low_resolution: 'blurry',
      no_face: 'face_not_found',
      not_found: 'face_not_found',
      no_person: 'body_not_fully_visible',
      partial_body: 'body_not_fully_visible',
      multiple_faces: 'multiple_people',
      group: 'multiple_people',
    };

    const unusable = unusableReplySchema.safeParse(reply);
    if (unusable.success) {
      const issues = (unusable.data.qualityIssues ?? [])
        .map((q) => {
          const direct = photoQualityIssueSchema.safeParse(q);
          if (direct.success) return direct.data;
          const mapped = typeof q === 'string' ? qualitySynonyms[q.toLowerCase().trim()] : undefined;
          return mapped;
        })
        .filter((r): r is PhotoQualityIssue => Boolean(r));

      const message = issues.length
        ? issues.map((q) => PHOTO_QUALITY_MESSAGES[q]).join(' ')
        : kind === 'face'
          ? 'We could not see your full face clearly. Please use a well-lit photo showing your full face (forehead, both cheeks, and jawline).'
          : 'This photo can’t be analysed. Please try another one with your full body visible, or choose manually.';
      throw new AppError('PHOTO_UNUSABLE', message);
    }

    let rawConfidence = raw.confidence;
    if (typeof rawConfidence === 'string') {
      rawConfidence = rawConfidence.toLowerCase().trim();
    }
    const base = usableBase.safeParse({ usable: raw.usable, confidence: rawConfidence });

    const normalizedRest: Record<string, unknown> = { ...raw };
    delete normalizedRest.usable;
    delete normalizedRest.confidence;

    if (kind === 'face') {
      if (typeof normalizedRest.monkTone === 'string') {
        normalizedRest.monkTone = parseInt(normalizedRest.monkTone, 10);
      }
      if (typeof normalizedRest.undertone === 'string') {
        normalizedRest.undertone = normalizedRest.undertone.toLowerCase().trim();
      }
    } else {
      if (typeof normalizedRest.bodyType === 'string') {
        normalizedRest.bodyType = normalizedRest.bodyType
          .toLowerCase()
          .trim()
          .replace(/[\s-]+/g, '_');
      }
    }

    const parsed =
      kind === 'face'
        ? faceAnalysisResultSchema.safeParse(normalizedRest)
        : bodyAnalysisResultSchema.safeParse(normalizedRest);
    const allowed =
      parsed.success &&
      (kind === 'face' ||
        (bodyTypesFor(department!) as readonly string[]).includes((parsed.data as { bodyType: string }).bodyType));
    if (!base.success || !parsed.success || !allowed) {
      // Never the reply itself: it holds the user's skin tone, undertone or body type (CONTRIBUTING §5).
      this.logger.warn({ event: 'photo_analysis_failed', kind, cause: 'invalid_output' });
      throw new AppError('AI_UNAVAILABLE', FAILED);
    }
    return { result: parsed.data, confidence: base.data.confidence };
  }
}
