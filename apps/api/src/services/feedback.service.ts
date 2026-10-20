import type { Types } from 'mongoose';
import type { OutfitFeedbackRequest } from '@styleme/contracts';
import type { Models, OutfitDoc } from '../models/index';
import { AppError } from '../utils/errors';
import type { FeedbackSignals } from './engine/score';

type StoredOutfit = OutfitDoc & { _id: Types.ObjectId };

// Look feedback (FR-OUT-04, issue #42). Scoped to the authenticated user. Feedback is stored on
// `outfits.feedback` ({ value, reason?, at }), so no new collection is created and account deletion
// and tombstone replay clear it with the look. Feedback is a lowest-precedence soft preference signal
// for future recommendations (D-115) and never changes the explicit profile.

export class FeedbackService {
  constructor(
    private readonly models: Models,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The user's own looks that still exist: saved ones, and suggestions not yet past their expiry. */
  private owned(userId: Types.ObjectId, id: Types.ObjectId) {
    const live = { $or: [{ expiresAt: null }, { expiresAt: { $gt: this.now() } }] };
    return { _id: id, userId, ...live };
  }

  /**
   * Sets or replaces feedback on one of the user's looks (FR-OUT-04, issue #42). One current
   * reaction per look; sending feedback again replaces the previous reaction. The user's explicit
   * profile preferences are NEVER modified.
   */
  async record(userId: Types.ObjectId, outfitId: Types.ObjectId, request: OutfitFeedbackRequest): Promise<void> {
    const existing = await this.models.Outfit.findOne(this.owned(userId, outfitId)).lean<StoredOutfit>();
    if (!existing) throw new AppError('NOT_FOUND');

    const feedback = {
      value: request.value,
      reason: request.reason ?? null,
      at: this.now(),
    };

    const doc = await this.models.Outfit.findOneAndUpdate(
      this.owned(userId, outfitId),
      { $set: { feedback } },
      { returnDocument: 'after' },
    );
    if (!doc) throw new AppError('NOT_FOUND');
  }

  /**
   * Aggregates feedback on looks for the recommendation engine as lowest-precedence ranking signals (D-115).
   * Soft signal: never overrides explicit profile preferences or the current request.
   */
  async getSignals(userId: Types.ObjectId): Promise<FeedbackSignals> {
    const docs = await this.models.Outfit.find(
      { userId, feedback: { $ne: null } },
      { templateId: 1, paletteId: 1, feedback: 1 },
    ).lean<StoredOutfit[]>();

    const templates = new Map<string, number>();
    const palettes = new Map<string, number>();

    for (const doc of docs) {
      if (!doc.feedback) continue;
      const delta = doc.feedback.value === 'love_it' ? 1 : -1;
      templates.set(doc.templateId, (templates.get(doc.templateId) ?? 0) + delta);
      palettes.set(doc.paletteId, (palettes.get(doc.paletteId) ?? 0) + delta);
    }

    return { templates, palettes };
  }
}
