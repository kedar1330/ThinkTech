import { Router, type RequestHandler } from 'express';
import type { ManualController } from '../controllers/manual.controller';

export function manualRoutes(controller: ManualController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/manual', ...auth, controller.list);
  return router;
}
