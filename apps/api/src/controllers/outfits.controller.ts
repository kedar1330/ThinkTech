import type { Request, RequestHandler } from 'express';
import { Types } from 'mongoose';
import {
  objectIdSchema,
  slotIdSchema,
  type LookPicksResponse,
  type PickProductRequest,
  type DeletedResponse,
  type LookPriceRange,
  type LookProductMatches,
  type FeedbackRecordedResponse,
  type OutfitFeedbackRequest,
  type OutfitListQuery,
} from '@styleme/contracts';
import type { OutfitsService } from '../services/outfits.service';
import type { PriceRangeService } from '../services/price-range.service';
import type { FeedbackService } from '../services/feedback.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every look is read, saved, rated or removed for the authenticated user only. */
export class OutfitsController {
  constructor(
    private readonly outfits: OutfitsService,
    private readonly feedbackService?: FeedbackService,
    private readonly priceRanges?: PriceRangeService,
  ) {}

  list: RequestHandler = async (req, res) => {
    sendData(res, await this.outfits.list(userOf(req), res.locals.query as OutfitListQuery));
  };

  get: RequestHandler = async (req, res) => {
    const look = await this.outfits.get(userOf(req), outfitIdOf(req));
    // Attached items carry user-entered prices (AC-B1, B-05).
    sendData(res, look, 200, look.userItems.length ? ['USER_ENTERED_PRICES'] : undefined);
  };

  /** The look's AI outfit image (raw bytes); private to its owner, never cached by a shared proxy. */
  image: RequestHandler = async (req, res) => {
    const { data, contentType } = await this.outfits.image(userOf(req), outfitIdOf(req));
    res.set({ 'content-type': contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
    res.send(data);
  };

  /** The look's price range from store search results (#118); labelled, never a StyleMe price. */
  priceRange: RequestHandler = async (req, res) => {
    if (!this.priceRanges) throw new AppError('PROVIDER_NOT_CONFIGURED');
    sendData<LookPriceRange>(res, await this.priceRanges.range(userOf(req), outfitIdOf(req)));
  };

  /** Similar products for the look's garments from store search results (#120); labelled, never exact. */
  products: RequestHandler = async (req, res) => {
    if (!this.priceRanges) throw new AppError('PROVIDER_NOT_CONFIGURED');
    sendData<LookProductMatches>(res, await this.priceRanges.products(userOf(req), outfitIdOf(req)));
  };

  /** The products the user picked for the look's garments (#120). */
  picks: RequestHandler = async (req, res) => {
    sendData<LookPicksResponse>(res, { picks: await this.priceRangesOrFail().picks(userOf(req), outfitIdOf(req)) });
  };

  pick: RequestHandler = async (req, res) => {
    const picks = await this.priceRangesOrFail().pick(userOf(req), outfitIdOf(req), req.body as PickProductRequest);
    sendData<LookPicksResponse>(res, { picks });
  };

  unpick: RequestHandler = async (req, res) => {
    const slotId = slotIdSchema.safeParse(req.params.slotId);
    if (!slotId.success) throw new AppError('INVALID_REQUEST');
    sendData<LookPicksResponse>(res, {
      picks: await this.priceRangesOrFail().unpick(userOf(req), outfitIdOf(req), slotId.data),
    });
  };

  private priceRangesOrFail(): PriceRangeService {
    if (!this.priceRanges) throw new AppError('PROVIDER_NOT_CONFIGURED');
    return this.priceRanges;
  }

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
