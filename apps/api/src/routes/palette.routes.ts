import { Router, type RequestHandler } from 'express';
import { paletteListQuerySchema } from '@styleme/contracts';
import type { PaletteController } from '../controllers/palette.controller';
import { validateQuery } from '../middleware/validate';

// /v1/style/palettes (API.md §3.4). Pipeline: route → authentication → validation → controller → service.
export function paletteRoutes(controller: PaletteController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/style/palettes', ...auth, validateQuery(paletteListQuerySchema), controller.list);
  return router;
}
