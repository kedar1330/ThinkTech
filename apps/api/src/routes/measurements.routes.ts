import { Router, type RequestHandler } from 'express';
import { updateMeasurementsRequestSchema } from '@styleme/contracts';
import type { MeasurementsController } from '../controllers/measurements.controller';
import { validateBody } from '../middleware/validate';

// /v1/measurements (API.md §3.9a, D-129). Pipeline: route → authentication → validation → controller → service.
export function measurementsRoutes(controller: MeasurementsController, auth: RequestHandler[]): Router {
  const router = Router();
  router.get('/measurements', ...auth, controller.get);
  router.put('/measurements', ...auth, validateBody(updateMeasurementsRequestSchema), controller.update);
  return router;
}
