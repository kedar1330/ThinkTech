import { Router, type RequestHandler } from 'express';
import {
  attachShortlistItemRequestSchema,
  createShortlistItemRequestSchema,
  shortlistListQuerySchema,
} from '@styleme/contracts';
import type { ShortlistController } from '../controllers/shortlist.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateBody, validateQuery } from '../middleware/validate';

// /v1/shortlist (API.md §3.6). Pipeline: route → authentication → validation → controller → service.
// No edit endpoint: an item is changed by deleting it and adding it again (FR-LIST-04).
export function shortlistRoutes(controller: ShortlistController, auth: RequestHandler[], limits: Limits = []): Router {
  const router = Router();
  router.get('/shortlist', ...auth, validateQuery(shortlistListQuerySchema), controller.list);
  router.post('/shortlist', ...auth, ...limits, validateBody(createShortlistItemRequestSchema), controller.create);
  router.delete('/shortlist/:id', ...auth, ...limits, controller.remove);
  // Attach an existing item to a slot of a saved look, or take it off again (#43).
  router.put(
    '/shortlist/:id/attach',
    ...auth,
    ...limits,
    validateBody(attachShortlistItemRequestSchema),
    controller.attach,
  );
  router.delete('/shortlist/:id/attach', ...auth, ...limits, controller.detach);
  return router;
}
