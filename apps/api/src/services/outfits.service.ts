import type { Types } from 'mongoose';
import type { Look, OutfitDetail, OutfitListQuery, OutfitListResponse, OutfitStatus } from '@styleme/contracts';
import type { Models, OutfitDoc } from '../models/index';
import { AppError } from '../utils/errors';

// Saved looks (FR-OUT-01 … 03, FR-OUT-05). Every query is scoped by `userId`, so another user's look,
// a missing one and an expired suggestion all read as NOT_FOUND (T-04: no existence leak). Saving only
// changes the status and the expiry: the slots, explanation and references stored when the look was
// generated are its snapshot, so a saved look reads the same after the library changes. Nothing here
// is logged.
//
// One save system (D-116): saved looks should also appear in `savedItems`. How they map (written on
// save, removed on delete, identity key, snapshot fields) is not agreed yet, so `save` and `remove`
// are the only places that change a look's saved state and the mirroring goes there once it is.

type StoredOutfit = OutfitDoc & { _id: Types.ObjectId };

function toLook(doc: StoredOutfit): Look {
  return {
    id: String(doc._id),
    status: doc.status as OutfitStatus,
    templateId: doc.templateId,
    paletteId: doc.paletteId,
    slots: doc.slots,
    explanation: doc.explanation,
    explanationRefs: doc.explanationRefs,
    combinationSignature: doc.combinationSignature,
    aiModel: doc.aiModel ?? null,
  };
}

export class OutfitsService {
  constructor(
    private readonly models: Models,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** The user's own looks that still exist: saved ones, and suggestions not yet past their expiry. */
  private owned(userId: Types.ObjectId, id?: Types.ObjectId) {
    // The TTL index removes expired suggestions within about a minute; this hides them until it does.
    const live = { $or: [{ expiresAt: null }, { expiresAt: { $gt: this.now() } }] };
    return id ? { _id: id, userId, ...live } : { userId, ...live };
  }

  /** `GET /v1/outfits`: newest first (by when the look was generated), one page at a time. */
  async list(userId: Types.ObjectId, query: OutfitListQuery): Promise<OutfitListResponse> {
    const filter = { ...this.owned(userId), status: query.status };
    const [docs, total] = await Promise.all([
      this.models.Outfit.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<StoredOutfit[]>(),
      this.models.Outfit.countDocuments(filter),
    ]);
    return { looks: docs.map(toLook), page: query.page, limit: query.limit, total };
  }

  /**
   * `GET /v1/outfits/:id`, suggested or saved. Items can't be attached to a look until Shop My Look
   * (#43), so `userItems` is always empty and there is no price summary; #43 adds both.
   */
  async get(userId: Types.ObjectId, id: Types.ObjectId): Promise<OutfitDetail> {
    const doc = await this.models.Outfit.findOne(this.owned(userId, id)).lean<StoredOutfit>();
    if (!doc) throw new AppError('NOT_FOUND');
    return { ...toLook(doc), userItems: [] };
  }

  /** `POST /v1/outfits/:id/save`: keeps the look (no expiry) exactly as generated. Idempotent. */
  async save(userId: Types.ObjectId, id: Types.ObjectId): Promise<Look> {
    const doc = await this.models.Outfit.findOneAndUpdate(
      this.owned(userId, id),
      { $set: { status: 'saved' }, $unset: { expiresAt: 1 } },
      { returnDocument: 'after' },
    ).lean<StoredOutfit>();
    if (!doc) throw new AppError('NOT_FOUND');
    return toLook(doc);
  }

  /** `DELETE /v1/outfits/:id`, saved or suggested. */
  async remove(userId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    const { deletedCount } = await this.models.Outfit.deleteOne(this.owned(userId, id));
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }
}
