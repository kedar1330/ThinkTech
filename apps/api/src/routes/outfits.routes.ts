import { Router, type RequestHandler } from 'express';
import { outfitFeedbackRequestSchema, outfitListQuerySchema } from '@styleme/contracts';
import type { OutfitsController } from '../controllers/outfits.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateBody, validateQuery } from '../middleware/validate';

export interface OutfitRateLimits {
  feedback?: Limits;
  /** AI outfit images: each first view calls the image provider. */
  image?: Limits;
  /** Price ranges: an uncached garment is a paid store search (#118). */
  priceRange?: Limits;
}

// /v1/outfits (API.md §3.5 #14 – #18). Pipeline: route → authentication → validation → controller →
// service. The `:id` is checked in the controller.
export function outfitsRoutes(
  controller: OutfitsController,
  auth: RequestHandler[],
  limits: OutfitRateLimits = {},
): Router {
  const router = Router();
  router.get('/outfits', ...auth, validateQuery(outfitListQuerySchema), controller.list);
  router.get('/outfits/:id', ...auth, controller.get);
  router.get('/outfits/:id/image', ...auth, ...(limits.image ?? []), controller.image);
  router.get('/outfits/:id/price-range', ...auth, ...(limits.priceRange ?? []), controller.priceRange);
  router.post('/outfits/:id/save', ...auth, controller.save);
  router.post(
    '/outfits/:id/feedback',
    ...auth,
    ...(limits.feedback ?? []),
    validateBody(outfitFeedbackRequestSchema),
    controller.feedback,
  );
  router.delete('/outfits/:id', ...auth, controller.remove);
  return router;
}
