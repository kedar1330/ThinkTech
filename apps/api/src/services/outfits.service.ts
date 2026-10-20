import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  OCCASIONS,
  SAVED_LIMITS,
  type Look,
  type LookInputs,
  type LookSlot,
  type OutfitDetail,
  type OutfitListQuery,
  type OutfitListResponse,
  type OutfitStatus,
  type RecommendationRequest,
} from '@styleme/contracts';
import type { Models, OutfitDoc } from '../models/index';
import { AppError } from '../utils/errors';
import type { StyleLibrary } from './engine';

// Saved looks (FR-OUT-01 … 03, FR-OUT-05). Every query is scoped by `userId`, so another user's look,
// a missing one and an expired suggestion all read as NOT_FOUND (T-04: no existence leak). Saving only
// changes the status and the expiry: the slots, explanation and references stored when the look was
// generated are its snapshot, so a saved look reads the same after the library changes. Nothing here
// is logged.
//
// One save system (D-116, mechanism agreed on #41 on 2026-10-20). `outfits` is the source of truth for
// the look; its `savedItems` entry is the look's place in the shared save system. Both are written here
// only, in an order that never leaves an entry pointing at a look that could expire or is gone:
// - save: mark the look saved, then upsert the entry. If the upsert fails the error is returned, and
//   because saving is idempotent a retry completes it.
// - remove: delete the entry, detach shortlist items, then delete the look. A failure part-way leaves a
//   saved look without an entry, which the next save or remove repairs.

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

/** A plain saved look has no customisation and look IDs are unique, so saving twice finds one entry. */
export function lookIdentityKey(outfitId: Types.ObjectId | string): string {
  return createHash('sha256')
    .update(`outfit|look|${String(outfitId)}`)
    .digest('hex');
}

const truncate = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const unique = <T>(values: T[]) => [...new Set(values)];

export class OutfitsService {
  constructor(
    private readonly models: Models,
    private readonly library: StyleLibrary,
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
    // The request and inputs snapshot let regenerate (#49) re-run the request and say what changed.
    return {
      ...toLook(doc),
      request: doc.request as RecommendationRequest,
      inputsUsed: doc.inputsUsed as LookInputs,
      userItems: [],
    };
  }

  /**
   * `POST /v1/outfits/:id/save`: keeps the look (no expiry) exactly as generated and gives it its
   * `savedItems` entry. Idempotent. A new save beyond `SAVED_LIMITS.itemsPerUser` is CONFLICT and the
   * look stays suggested.
   */
  async save(userId: Types.ObjectId, id: Types.ObjectId): Promise<Look> {
    const existing = await this.models.Outfit.findOne(this.owned(userId, id)).lean<StoredOutfit>();
    if (!existing) throw new AppError('NOT_FOUND');

    const identityKey = lookIdentityKey(id);
    if (!(await this.models.SavedItem.exists({ userId, identityKey }))) {
      if ((await this.models.SavedItem.countDocuments({ userId })) >= SAVED_LIMITS.itemsPerUser) {
        throw new AppError(
          'CONFLICT',
          `You can keep up to ${SAVED_LIMITS.itemsPerUser.toLocaleString('en-IN')} saved items. Remove one to save another.`,
        );
      }
    }

    const doc = await this.models.Outfit.findOneAndUpdate(
      this.owned(userId, id),
      { $set: { status: 'saved' }, $unset: { expiresAt: 1 } },
      { returnDocument: 'after' },
    ).lean<StoredOutfit>();
    if (!doc) throw new AppError('NOT_FOUND');

    await this.upsertSavedItem(userId, doc, identityKey);
    return toLook(doc);
  }

  /**
   * `DELETE /v1/outfits/:id`, saved or suggested: removes its `savedItems` entry, detaches the user's
   * shortlist items from it (they stay in the shortlist, FR-LIST-04), then deletes the look.
   */
  async remove(userId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    if (!(await this.models.Outfit.exists(this.owned(userId, id)))) throw new AppError('NOT_FOUND');
    await this.models.SavedItem.deleteOne({ userId, identityKey: lookIdentityKey(id) });
    await this.models.ShortlistItem.updateMany({ userId, outfitId: id }, { $set: { outfitId: null, slotId: null } });
    const { deletedCount } = await this.models.Outfit.deleteOne(this.owned(userId, id));
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  /**
   * The look's entry in the shared save system, filled from the look at save time (DATABASE.md §3.10).
   * Inserted once: a repeated save leaves the entry (and anything the user later changes on it) as is.
   */
  private async upsertSavedItem(userId: Types.ObjectId, doc: StoredOutfit, identityKey: string): Promise<void> {
    const request = doc.request as RecommendationRequest;
    const slots = doc.slots as LookSlot[];
    const template = this.library.getTemplate(doc.templateId);
    const palette = this.library.getPalette(doc.paletteId);
    const occasion = OCCASIONS.find((o) => o.id === request.occasion)?.label ?? request.occasion;
    const now = this.now();
    try {
      await this.models.SavedItem.updateOne(
        { userId, identityKey },
        {
          $setOnInsert: {
            userId,
            itemType: 'outfit',
            sourceFeature: 'discover_my_style',
            ref: { kind: 'look', id: String(doc._id) },
            identityKey,
            name: truncate(`${occasion} look: ${template?.name ?? doc.templateId}`, SAVED_LIMITS.nameMax),
            notes: null,
            isFavourite: false,
            collectionIds: [],
            customization: null,
            snapshot: {
              templateName: template?.name ?? null,
              paletteName: palette?.name ?? null,
              slots: slots.map((s) => ({
                slotId: s.slotId,
                category: s.lookSpec.category,
                swatches: s.swatches.map(({ colorId, name, hex }) => ({ colorId, name, hex })),
              })),
            },
            recommendationContext: {
              explanation: doc.explanation,
              ruleIds: doc.explanationRefs.ruleIds,
              attributes: doc.explanationRefs.attributes,
            },
            origin: { templateId: doc.templateId, paletteId: doc.paletteId },
            facets: {
              occasions: [request.occasion],
              styles: request.style ? [request.style] : [],
              categories: unique(slots.map((s) => s.lookSpec.category)),
              colorIds: unique(slots.flatMap((s) => s.swatches.map((w) => w.colorId))),
            },
            derivedFromId: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, timestamps: false },
      );
    } catch (err) {
      // Two saves of the same look at once: the other request created the entry first.
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
}
