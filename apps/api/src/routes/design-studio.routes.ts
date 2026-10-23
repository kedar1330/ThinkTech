import express, { Router, type RequestHandler } from 'express';
import { DESIGN_IMAGE_MAX_BYTES, DESIGN_REQUEST_CONTENT_TYPE, createDesignRequestSchema } from '@styleme/contracts';
import type { DesignStudioController } from '../controllers/design-studio.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';

// /v1/design-studio (API.md §3.9c, D-134). Pipeline: route → authentication → rate limit → body parser
// for the design content type (the base64 sketch is larger than the global 16 kB JSON limit) →
// validation → controller → service.
export function designStudioRoutes(
  controller: DesignStudioController,
  auth: RequestHandler[],
  limits: Limits = [],
): Router {
  const router = Router();
  const designJson = express.json({
    type: DESIGN_REQUEST_CONTENT_TYPE,
    // base64 is 4/3 of the image, plus room for the description.
    limit: Math.ceil((DESIGN_IMAGE_MAX_BYTES * 4) / 3) + 16 * 1024,
  });
  router.get('/design-studio', ...auth, controller.overview);
  router.post(
    '/design-studio/designs',
    ...auth,
    ...limits,
    designJson,
    validateBody(createDesignRequestSchema),
    controller.create,
  );
  router.get('/design-studio/designs/:id', ...auth, controller.get);
  router.get('/design-studio/designs/:id/image', ...auth, controller.image);
  router.post('/design-studio/designs/:id/render', ...auth, ...limits, controller.render);
  router.delete('/design-studio/designs/:id', ...auth, controller.remove);
  return router;
}
