import { Types } from 'mongoose';
import {
  SHORTLIST_LIMITS,
  type AttachShortlistItemRequest,
  type CreateShortlistItemRequest,
  type ShortlistListQuery,
  type ShortlistListResponse,
  type UserShortlistItem,
} from '@styleme/contracts';
import type { Models, ShortlistItemDoc } from '../models/index';
import { AppError } from '../utils/errors';

// Shortlist of items the user found elsewhere (FR-LIST, D-77 = B, D-80). Every query is scoped to the
// user, so another user's item is simply not found. Links are stored as entered and never requested,
// previewed or changed (FR-LIST-03, -05); nothing here is logged.
//
// Attaching (#43, AC-B4): an item goes on one slot (`{ outfitId, slotId }`, D-82) of one of the user's
// own *saved* looks, at most one item per slot (unique partial index on shortlistItems). Deleting the
// look detaches its items (outfits.service.ts).

type StoredItem = ShortlistItemDoc & { _id: Types.ObjectId };

const SLOT_TAKEN = 'That part of the look already has an item. Remove it from the look first.';

/** MongoDB's duplicate-key error: two requests raced for the same slot. */
const isDuplicateKey = (err: unknown) => (err as { code?: number } | null)?.code === 11000;

export class ShortlistService {
  constructor(private readonly models: Models) {}

  /** The user's items, newest first (FR-LIST-04), optionally only those attached to one look. */
  async list(userId: Types.ObjectId, query: ShortlistListQuery): Promise<ShortlistListResponse> {
    const filter = {
      userId,
      ...(query.outfitId ? { outfitId: new Types.ObjectId(query.outfitId) } : {}),
    };
    const [docs, total] = await Promise.all([
      this.models.ShortlistItem.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<StoredItem[]>(),
      this.models.ShortlistItem.countDocuments(filter),
    ]);
    return { items: docs.map(toItem), page: query.page, limit: query.limit, total };
  }

  /**
   * Adds an item (FR-LIST-01, -07), unattached or on a slot of a saved look. At most
   * `SHORTLIST_LIMITS.itemsPerUser` items per user.
   */
  async create(userId: Types.ObjectId, request: CreateShortlistItemRequest): Promise<UserShortlistItem> {
    const slot =
      request.outfitId !== undefined && request.slotId !== undefined
        ? await this.freeSlot(userId, { outfitId: request.outfitId, slotId: request.slotId })
        : null;
    if ((await this.models.ShortlistItem.countDocuments({ userId })) >= SHORTLIST_LIMITS.itemsPerUser) {
      throw new AppError(
        'CONFLICT',
        `You can keep up to ${SHORTLIST_LIMITS.itemsPerUser} items. Remove one to add another.`,
      );
    }
    try {
      const doc = await this.models.ShortlistItem.create({
        userId,
        name: request.name,
        priceEntered: request.priceEntered,
        url: request.url ?? null,
        // The contract trims the note, so a note of only spaces arrives empty and is kept as no note.
        note: request.note || null,
        outfitId: slot?.outfitId ?? null,
        slotId: slot?.slotId ?? null,
      });
      return toItem(doc.toObject<StoredItem>());
    } catch (err) {
      if (isDuplicateKey(err)) throw new AppError('CONFLICT', SLOT_TAKEN);
      throw err;
    }
  }

  /** Puts one of the user's items on a slot of one of their saved looks (#43). Moving an item is allowed. */
  async attach(
    userId: Types.ObjectId,
    id: Types.ObjectId,
    target: AttachShortlistItemRequest,
  ): Promise<UserShortlistItem> {
    const item = await this.models.ShortlistItem.findOne({ _id: id, userId }).lean<StoredItem>();
    if (!item) throw new AppError('NOT_FOUND');
    const slot = await this.freeSlot(userId, target, id);
    try {
      const doc = await this.models.ShortlistItem.findOneAndUpdate(
        { _id: id, userId },
        { $set: { outfitId: slot.outfitId, slotId: slot.slotId } },
        { new: true },
      ).lean<StoredItem>();
      if (!doc) throw new AppError('NOT_FOUND');
      return toItem(doc);
    } catch (err) {
      if (isDuplicateKey(err)) throw new AppError('CONFLICT', SLOT_TAKEN);
      throw err;
    }
  }

  /** Takes one of the user's items off its look; it stays in the shortlist. Harmless when unattached. */
  async detach(userId: Types.ObjectId, id: Types.ObjectId): Promise<UserShortlistItem> {
    const doc = await this.models.ShortlistItem.findOneAndUpdate(
      { _id: id, userId },
      { $set: { outfitId: null, slotId: null } },
      { new: true },
    ).lean<StoredItem>();
    if (!doc) throw new AppError('NOT_FOUND');
    return toItem(doc);
  }

  /** Deletes one of the user's items (FR-LIST-04). Another user's item is `NOT_FOUND`. */
  async remove(userId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    const { deletedCount } = await this.models.ShortlistItem.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }

  /**
   * Checks a target slot (AC-B4, B-03): the look is the user's and saved (`NOT_FOUND` otherwise, so
   * another user's look isn't revealed), the slot exists in it (`INVALID_REQUEST`), and no other item is
   * on it (`CONFLICT`). `itemId` is the item being moved, which may already be there.
   */
  private async freeSlot(
    userId: Types.ObjectId,
    { outfitId, slotId }: AttachShortlistItemRequest,
    itemId?: Types.ObjectId,
  ): Promise<{ outfitId: Types.ObjectId; slotId: string }> {
    const look = await this.models.Outfit.findOne(
      { _id: new Types.ObjectId(outfitId), userId, status: 'saved' },
      { slots: 1 },
    ).lean<{ slots: { slotId: string }[] }>();
    if (!look) throw new AppError('NOT_FOUND');
    if (!look.slots.some((s) => s.slotId === slotId))
      throw new AppError('INVALID_REQUEST', 'That look has no such part');
    const taken = await this.models.ShortlistItem.exists({
      userId,
      outfitId: new Types.ObjectId(outfitId),
      slotId,
      ...(itemId ? { _id: { $ne: itemId } } : {}),
    });
    if (taken) throw new AppError('CONFLICT', SLOT_TAKEN);
    return { outfitId: new Types.ObjectId(outfitId), slotId };
  }
}

/** A stored item as returned by the API; also used for a look's attached items (outfits.service.ts). */
export function toItem(doc: StoredItem): UserShortlistItem {
  return {
    id: String(doc._id),
    name: doc.name,
    priceEntered: doc.priceEntered,
    currency: 'INR',
    priceBasis: 'user_entered',
    verifiedByStyleMe: false,
    url: doc.url ?? null,
    note: doc.note ?? null,
    outfitId: doc.outfitId ? String(doc.outfitId) : null,
    slotId: doc.slotId ?? null,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}
