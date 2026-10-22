import { Router, type RequestHandler } from 'express';
import { confirmAppearanceRequestSchema, updateAppearanceRequestSchema } from '@styleme/contracts';
import type { AppearanceController } from '../controllers/appearance.controller';
import { validateBody } from '../middleware/validate';

// /v1/appearance (API.md §3.3). Pipeline: route → authentication → validation → controller → service.
export function appearanceRoutes(controller: AppearanceController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/appearance', ...auth, controller.get);
  router.put('/appearance', ...auth, validateBody(updateAppearanceRequestSchema), controller.update);
  // The user reviewed a photo or measurement result and it is right (D-129).
  router.post('/appearance/confirm', ...auth, validateBody(confirmAppearanceRequestSchema), controller.confirm);
  return router;
}
