import { Router, type RequestHandler } from 'express';
import { createShortlistItemRequestSchema, shortlistListQuerySchema } from '@styleme/contracts';
import type { ShortlistController } from '../controllers/shortlist.controller';
import { validateBody, validateQuery } from '../middleware/validate';

// /v1/shortlist (API.md §3.6). Pipeline: route → authentication → validation → controller → service.
// No edit endpoint: an item is changed by deleting it and adding it again (FR-LIST-04).
export function shortlistRoutes(controller: ShortlistController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/shortlist', ...auth, validateQuery(shortlistListQuerySchema), controller.list);
  router.post('/shortlist', ...auth, validateBody(createShortlistItemRequestSchema), controller.create);
  router.delete('/shortlist/:id', ...auth, controller.remove);
  return router;
}
