import { Types } from 'mongoose';
import {
  SHORTLIST_LIMITS,
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

type StoredItem = ShortlistItemDoc & { _id: Types.ObjectId };

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

  /** Adds an unattached item (FR-LIST-01, -07). At most `SHORTLIST_LIMITS.itemsPerUser` items per user. */
  async create(userId: Types.ObjectId, request: CreateShortlistItemRequest): Promise<UserShortlistItem> {
    // Attaching to a slot of a saved look needs the saved-look checks, the one-item-per-slot rule and
    // detaching when the look is deleted, which arrive together with Shop My Look (#43).
    if (request.outfitId !== undefined) {
      throw new AppError('INVALID_REQUEST', 'Adding an item to a look is not available yet');
    }
    if ((await this.models.ShortlistItem.countDocuments({ userId })) >= SHORTLIST_LIMITS.itemsPerUser) {
      throw new AppError(
        'CONFLICT',
        `You can keep up to ${SHORTLIST_LIMITS.itemsPerUser} items. Remove one to add another.`,
      );
    }
    const doc = await this.models.ShortlistItem.create({
      userId,
      name: request.name,
      priceEntered: request.priceEntered,
      url: request.url ?? null,
      // The contract trims the note, so a note of only spaces arrives empty and is kept as no note.
      note: request.note || null,
    });
    return toItem(doc.toObject<StoredItem>());
  }

  /** Deletes one of the user's items (FR-LIST-04). Another user's item is `NOT_FOUND`. */
  async remove(userId: Types.ObjectId, id: Types.ObjectId): Promise<void> {
    const { deletedCount } = await this.models.ShortlistItem.deleteOne({ _id: id, userId });
    if (deletedCount === 0) throw new AppError('NOT_FOUND');
  }
}

function toItem(doc: StoredItem): UserShortlistItem {
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
