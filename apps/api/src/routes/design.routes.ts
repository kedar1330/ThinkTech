import { Router, type RequestHandler } from 'express';
import {
  designFeaturesQuerySchema,
  designTaxonomyQuerySchema,
  saveDesignSelectionRequestSchema,
  updateDesignPreferencesRequestSchema,
} from '@styleme/contracts';
import type { DesignController } from '../controllers/design.controller';
import { validateBody, validateQuery } from '../middleware/validate';

// /v1/design/* (API.md §3.12, D-132). Pipeline: route → authentication → validation → controller → service.
export function designRoutes(controller: DesignController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/design/taxonomy', ...auth, validateQuery(designTaxonomyQuerySchema), controller.taxonomy);
  router.get('/design/features', ...auth, validateQuery(designFeaturesQuerySchema), controller.features);
  router.get('/design/preferences', ...auth, controller.getPreferences);
  router.put(
    '/design/preferences',
    ...auth,
    validateBody(updateDesignPreferencesRequestSchema),
    controller.updatePreferences,
  );
  router.get('/design/selections', ...auth, controller.listSelections);
  router.put('/design/selections', ...auth, validateBody(saveDesignSelectionRequestSchema), controller.saveSelection);
  router.delete('/design/selections/:garmentType', ...auth, controller.deleteSelection);
  return router;
}
