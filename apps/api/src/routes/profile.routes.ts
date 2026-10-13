import { Router, type RequestHandler } from 'express';
import { updateProfileRequestSchema } from '@styleme/contracts';
import type { ProfileController } from '../controllers/profile.controller';
import { validateBody } from '../middleware/validate';

// /v1/profile (API.md §3.2). Pipeline: route → authentication → validation → controller → service.
export function profileRoutes(controller: ProfileController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/profile', ...auth, controller.get);
  router.put('/profile', ...auth, validateBody(updateProfileRequestSchema), controller.update);
  return router;
}
