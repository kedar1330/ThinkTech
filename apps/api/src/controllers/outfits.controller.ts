import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import {
  objectIdSchema,
  type DeletedResponse,
  type FeedbackRecordedResponse,
  type OutfitFeedbackRequest,
  type OutfitListQuery,
} from '@styleme/contracts';
import type { OutfitsService } from '../services/outfits.service';
import type { FeedbackService } from '../services/feedback.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every look is read, saved, rated or removed for the authenticated user only. */
export class OutfitsController {
  constructor(
    private readonly outfits: OutfitsService,
    private readonly feedbackService?: FeedbackService,
  ) {}

  list: RequestHandler = async (req, res) => {
    sendData(res, await this.outfits.list(userOf(req), res.locals.query as OutfitListQuery));
  };

  get: RequestHandler = async (req, res) => {
    const look = await this.outfits.get(userOf(req), outfitIdOf(req));
    // Attached items carry user-entered prices (AC-B1, B-05).
    sendData(res, look, 200, look.userItems.length ? ['USER_ENTERED_PRICES'] : undefined);
  };

  save: RequestHandler = async (req, res) => {
    sendData(res, await this.outfits.save(userOf(req), outfitIdOf(req)));
  };

  feedback: RequestHandler = async (req, res) => {
    if (!this.feedbackService) throw new AppError('INTERNAL_ERROR', 'FeedbackService not configured');
    await this.feedbackService.record(userOf(req), outfitIdOf(req), req.body as OutfitFeedbackRequest);
    sendData<FeedbackRecordedResponse>(res, { recorded: true });
  };

  remove: RequestHandler = async (req, res) => {
    await this.outfits.remove(userOf(req), outfitIdOf(req));
    sendData<DeletedResponse>(res, { deleted: true });
  };
}

function userOf(req: Request): Types.ObjectId {
  if (!req.auth) throw new AppError('UNAUTHENTICATED');
  return req.auth.user._id;
}

/** A malformed `:id` is INVALID_REQUEST; a well-formed one that isn't the user's is NOT_FOUND (service). */
function outfitIdOf(req: Request): Types.ObjectId {
  const id = objectIdSchema.safeParse(req.params.id);
  if (!id.success) throw new AppError('INVALID_REQUEST');
  return new Types.ObjectId(id.data);
}
