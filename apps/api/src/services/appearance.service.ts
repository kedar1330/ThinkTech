import type { Types } from 'mongoose';
import {
  bodyTypeProportion,
  type AppearanceAttribute,
  type AppearanceResponse,
  type AttributeSource,
  type BodyType,
  type ConfidenceLabel,
  type ConfirmAppearanceRequest,
  type UpdateAppearanceRequest,
} from '@styleme/contracts';
import type { AppearanceProfileDoc, Models } from '../models/index';

// Appearance (FR-SIG-01 … 07, D-129). The user's own choices are stored as `self_reported` (or
// `user_corrected` when they replace a photo or measurement result) with `userConfirmed: true`. Photo and
// measurement results are applied through `applyEstimate` with `userConfirmed: false` until the user
// confirms them. Values are never logged.

type AttributeName = 'skinTone' | 'undertone' | 'bodyProportions' | 'bodyType';
const ATTRIBUTES: readonly AttributeName[] = ['skinTone', 'undertone', 'bodyProportions', 'bodyType'];

type StoredAttribute = {
  value: unknown;
  source: string;
  userConfirmed: boolean;
  confirmedAt?: Date | null;
  estimate?: { analysisId?: Types.ObjectId | string; confidence?: string | null } | null;
} | null;

const EMPTY: AppearanceResponse = {
  skinTone: null,
  undertone: null,
  bodyProportions: null,
  bodyType: null,
  useInRecommendations: true,
};

function toAttribute(stored: StoredAttribute | undefined): AppearanceAttribute<never> | null {
  if (!stored || stored.value === null || stored.value === undefined) return null;
  const estimate = stored.estimate?.analysisId
    ? {
        analysisId: String(stored.estimate.analysisId),
        confidence: (stored.estimate.confidence ?? null) as ConfidenceLabel | null,
      }
    : null;
  return {
    value: stored.value as never,
    source: stored.source as AttributeSource,
    userConfirmed: stored.userConfirmed,
    confirmedAt: stored.confirmedAt ? stored.confirmedAt.toISOString() : null,
    estimate,
  };
}

function toResponse(doc: AppearanceProfileDoc | null): AppearanceResponse {
  if (!doc) return EMPTY;
  return {
    skinTone: toAttribute(doc.skinTone as StoredAttribute),
    undertone: toAttribute(doc.undertone as StoredAttribute),
    bodyProportions: toAttribute(doc.bodyProportions as StoredAttribute),
    bodyType: toAttribute(doc.bodyType as StoredAttribute),
    useInRecommendations: doc.useInRecommendations,
  };
}

/** A photo or measurement result to store for review. */
export interface AppearanceEstimate {
  source: 'photo_estimate' | 'measurements';
  analysisId: Types.ObjectId;
  confidence: ConfidenceLabel | null;
  values: Partial<{ skinTone: { monkRange: string }; undertone: string; bodyType: BodyType }>;
  analysisVersion?: string;
}

export class AppearanceService {
  constructor(private readonly models: Models) {}

  /** The user's appearance; all `null` (and the toggle on) when nothing is set. */
  async get(userId: Types.ObjectId): Promise<AppearanceResponse> {
    return toResponse(await this.models.AppearanceProfile.findOne({ userId }).lean());
  }

  /**
   * The user's own choice: sets, changes or clears values (`value: null` clears). Replacing a photo or
   * measurement result is recorded as `user_corrected`. Setting `bodyType` also sets `bodyProportions`.
   */
  async update(userId: Types.ObjectId, input: UpdateAppearanceRequest): Promise<AppearanceResponse> {
    const now = new Date();
    const existing = await this.models.AppearanceProfile.findOne({ userId }).lean();
    const changes: Partial<Record<AttributeName, unknown>> = {};
    for (const name of ATTRIBUTES) {
      const change = input[name];
      if (change !== undefined) changes[name] = change.value;
    }
    if (changes.bodyType !== undefined) {
      changes.bodyProportions = changes.bodyType === null ? null : bodyTypeProportion(changes.bodyType as BodyType);
    }

    const set: Record<string, unknown> = {};
    const corrected: Types.ObjectId[] = [];
    for (const [name, value] of Object.entries(changes) as [AttributeName, unknown][]) {
      if (value === null) {
        set[name] = null;
        continue;
      }
      const previous = existing?.[name] as StoredAttribute | undefined;
      const replacesEstimate = Boolean(previous?.estimate?.analysisId);
      if (replacesEstimate && previous!.source !== 'user_corrected' && previous!.value !== value) {
        corrected.push(previous!.estimate!.analysisId as Types.ObjectId);
      }
      set[name] = replacesEstimate
        ? { value, source: 'user_corrected', userConfirmed: true, confirmedAt: now, estimate: previous!.estimate }
        : { value, source: 'self_reported', userConfirmed: true, confirmedAt: now, estimate: null };
    }
    if (input.useInRecommendations !== undefined) set.useInRecommendations = input.useInRecommendations;

    const doc = await this.models.AppearanceProfile.findOneAndUpdate(
      { userId },
      { $set: set, $setOnInsert: { userId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    if (corrected.length > 0) {
      await this.models.AppearanceAnalysis.updateMany(
        { userId, _id: { $in: corrected } },
        { $set: { status: 'corrected', reviewedAt: now } },
      );
    }
    return toResponse(doc);
  }

  /** Stores a photo or measurement result at once, unconfirmed, so every feature can read it. */
  async applyEstimate(userId: Types.ObjectId, estimate: AppearanceEstimate): Promise<AppearanceResponse> {
    const attribute = (value: unknown) => ({
      value,
      source: estimate.source,
      userConfirmed: false,
      confirmedAt: null,
      estimate: { analysisId: estimate.analysisId, confidence: estimate.confidence },
    });
    const set: Record<string, unknown> = {};
    const { skinTone, undertone, bodyType } = estimate.values;
    if (skinTone) set.skinTone = attribute(skinTone);
    if (undertone) set.undertone = attribute(undertone);
    if (bodyType) {
      set.bodyType = attribute(bodyType);
      set.bodyProportions = attribute(bodyTypeProportion(bodyType));
    }
    if (estimate.analysisVersion) set.analysisVersion = estimate.analysisVersion;
    const doc = await this.models.AppearanceProfile.findOneAndUpdate(
      { userId },
      { $set: set, $setOnInsert: { userId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return toResponse(doc);
  }

  /** The user reviewed a result and it is right: mark it confirmed, keeping its source. */
  async confirm(userId: Types.ObjectId, input: ConfirmAppearanceRequest): Promise<AppearanceResponse> {
    const now = new Date();
    const existing = await this.models.AppearanceProfile.findOne({ userId }).lean();
    const set: Record<string, unknown> = {};
    const analysisIds: Types.ObjectId[] = [];
    const names: AttributeName[] = [...input.attributes];
    if (input.attributes.includes('bodyType')) names.push('bodyProportions');
    for (const name of names) {
      const stored = existing?.[name] as StoredAttribute | undefined;
      if (!stored || stored.value === null || stored.value === undefined) continue;
      set[`${name}.userConfirmed`] = true;
      set[`${name}.confirmedAt`] = now;
      if (stored.estimate?.analysisId) analysisIds.push(stored.estimate.analysisId as Types.ObjectId);
    }
    if (Object.keys(set).length === 0) return toResponse(existing);
    const doc = await this.models.AppearanceProfile.findOneAndUpdate(
      { userId },
      { $set: set },
      { returnDocument: 'after' },
    ).lean();
    if (analysisIds.length > 0) {
      await this.models.AppearanceAnalysis.updateMany(
        { userId, _id: { $in: analysisIds }, status: 'pending_review' },
        { $set: { status: 'confirmed', reviewedAt: now } },
      );
    }
    return toResponse(doc);
  }
}
