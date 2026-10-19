import { Router, type RequestHandler } from 'express';
import { recommendationRequestSchema } from '@styleme/contracts';
import type { RecommendationsController } from '../controllers/recommendations.controller';
import { validateBody } from '../middleware/validate';

// /v1/recommendations (API.md §3.5). Pipeline: route → authentication → validation → controller → service.
export function recommendationsRoutes(controller: RecommendationsController, auth: RequestHandler[]): Router {
  const router = Router();
  router.post('/recommendations', ...auth, validateBody(recommendationRequestSchema), controller.create);
  return router;
}
