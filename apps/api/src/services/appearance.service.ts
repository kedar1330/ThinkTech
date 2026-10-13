import type { Types } from 'mongoose';
import type { AppearanceAttribute, AppearanceResponse, UpdateAppearanceRequest } from '@styleme/contracts';
import type { AppearanceProfileDoc, Models } from '../models/index';

// Self-reported appearance signals (FR-SIG-01 … 07). Values are stored exactly as the user chose
// them, as `self_reported` and `userConfirmed: true`, with no confidence (DATABASE.md §5). They are
// never logged and never sent to any external service (AI rule 16).

type AttributeName = 'skinTone' | 'undertone' | 'bodyProportions';
const ATTRIBUTES: readonly AttributeName[] = ['skinTone', 'undertone', 'bodyProportions'];

type StoredAttribute = {
  value: unknown;
  source: string;
  userConfirmed: boolean;
  confirmedAt?: Date | null;
} | null;

const EMPTY: AppearanceResponse = {
  skinTone: null,
  undertone: null,
  bodyProportions: null,
  useInRecommendations: true,
};

function toAttribute(stored: StoredAttribute | undefined): AppearanceAttribute<never> | null {
  if (!stored || stored.value === null || stored.value === undefined) return null;
  return {
    value: stored.value as never,
    source: 'self_reported',
    userConfirmed: true,
    confirmedAt: (stored.confirmedAt ?? new Date(0)).toISOString(),
    estimate: null,
  };
}

function toResponse(doc: AppearanceProfileDoc | null): AppearanceResponse {
  if (!doc) return EMPTY;
  return {
    skinTone: toAttribute(doc.skinTone as StoredAttribute),
    undertone: toAttribute(doc.undertone as StoredAttribute),
    bodyProportions: toAttribute(doc.bodyProportions as StoredAttribute),
    useInRecommendations: doc.useInRecommendations,
  };
}

export class AppearanceService {
  constructor(private readonly models: Models) {}

  /** The user's signals; all `null` (and the toggle on) when they haven't set any. */
  async get(userId: Types.ObjectId): Promise<AppearanceResponse> {
    return toResponse(await this.models.AppearanceProfile.findOne({ userId }).lean());
  }

  /** Sets, changes or clears signals (`value: null` clears). Fields not sent are left unchanged. */
  async update(userId: Types.ObjectId, input: UpdateAppearanceRequest): Promise<AppearanceResponse> {
    const now = new Date();
    const set: Record<string, unknown> = {};
    for (const name of ATTRIBUTES) {
      const change = input[name];
      if (change === undefined) continue;
      set[name] =
        change.value === null
          ? null
          : { value: change.value, source: 'self_reported', userConfirmed: true, confirmedAt: now, estimate: null };
    }
    if (input.useInRecommendations !== undefined) set.useInRecommendations = input.useInRecommendations;

    const doc = await this.models.AppearanceProfile.findOneAndUpdate(
      { userId },
      { $set: set, $setOnInsert: { userId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    return toResponse(doc);
  }
}
