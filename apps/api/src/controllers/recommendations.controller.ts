import type { RequestHandler } from 'express';
import type { RecommendationRequest } from '@styleme/contracts';
import type { RecommendationsService } from '../services/recommendations.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: looks are generated for, and stored under, the authenticated user. */
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  create: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const { data, warnings } = await this.recommendations.recommend(
      req.auth.user._id,
      req.body as RecommendationRequest,
    );
    sendData(res, data, 200, warnings);
  };
}
