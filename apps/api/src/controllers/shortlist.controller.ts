import type { RequestHandler } from 'express';
import { Types } from 'mongoose';
import {
  objectIdSchema,
  type CreateShortlistItemRequest,
  type DeletedResponse,
  type ShortlistListQuery,
} from '@styleme/contracts';
import type { ShortlistService } from '../services/shortlist.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/**
 * HTTP only: every item belongs to the authenticated user. Responses that carry user-entered prices
 * include the `USER_ENTERED_PRICES` warning (AC-B1).
 */
export class ShortlistController {
  constructor(private readonly shortlist: ShortlistService) {}

  list: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const data = await this.shortlist.list(req.auth.user._id, res.locals.query as ShortlistListQuery);
    sendData(res, data, 200, data.items.length ? ['USER_ENTERED_PRICES'] : undefined);
  };

  create: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const item = await this.shortlist.create(req.auth.user._id, req.body as CreateShortlistItemRequest);
    sendData(res, item, 201, ['USER_ENTERED_PRICES']);
  };

  remove: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const id = objectIdSchema.safeParse(req.params.id);
    if (!id.success) throw new AppError('INVALID_REQUEST');
    await this.shortlist.remove(req.auth.user._id, new Types.ObjectId(id.data));
    sendData<DeletedResponse>(res, { deleted: true });
  };
}
