import { Router, type RequestHandler } from 'express';
import {
  catalogueCategoriesQuerySchema,
  clothingStylesQuerySchema,
  compareStylesQuerySchema,
} from '@styleme/contracts';
import type { CatalogueController } from '../controllers/catalogue.controller';
import { validateQuery } from '../middleware/validate';

// /v1/catalogue/* (API.md §3.11, F1 - F4). Pipeline: route → authentication → validation → controller → service.
export function catalogueRoutes(controller: CatalogueController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get(
    '/catalogue/categories',
    ...auth,
    validateQuery(catalogueCategoriesQuerySchema),
    controller.getCategories,
  );
  router.get(
    '/catalogue/styles/compare',
    ...auth,
    validateQuery(compareStylesQuerySchema),
    controller.compareStyles,
  );
  router.get('/catalogue/styles/:styleId', ...auth, controller.getStyleById);
  router.get('/catalogue/styles', ...auth, validateQuery(clothingStylesQuerySchema), controller.getStyles);
  return router;
}
