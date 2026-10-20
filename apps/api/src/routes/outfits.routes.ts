import { Router, type RequestHandler } from 'express';
import { outfitListQuerySchema } from '@styleme/contracts';
import type { OutfitsController } from '../controllers/outfits.controller';
import { validateQuery } from '../middleware/validate';

// /v1/outfits (API.md §3.5 #14 – #16, #18). Pipeline: route → authentication → validation → controller →
// service. The `:id` is checked in the controller. Feedback (#17) is added by #42.
export function outfitsRoutes(controller: OutfitsController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/outfits', ...auth, validateQuery(outfitListQuerySchema), controller.list);
  router.get('/outfits/:id', ...auth, controller.get);
  router.post('/outfits/:id/save', ...auth, controller.save);
  router.delete('/outfits/:id', ...auth, controller.remove);
  return router;
}
