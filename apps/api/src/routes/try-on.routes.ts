import { Router, type RequestHandler } from 'express';
import { startDrapeRequestSchema, startTryOnRequestSchema } from '@styleme/contracts';
import type { TryOnController } from '../controllers/try-on.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';

// /v1/try-on (API.md §3.16, D-137, D-138). Pipeline: route → authentication → rate limit → validation →
// controller → service. Starting a try-on is a paid fal.ai call; polling a try-on may call fal to check on it.
// A drape dresses the shared cartoon avatar with Pollinations image editing, one call per garment.
export function tryOnRoutes(
  controller: TryOnController,
  auth: RequestHandler[],
  limits: { start?: Limits; poll?: Limits; drape?: Limits; drapeView?: Limits } = {},
): Router {
  const router = Router();
  router.get('/try-on', ...auth, controller.overview);
  router.post(
    '/try-on/jobs',
    ...auth,
    ...(limits.start ?? []),
    validateBody(startTryOnRequestSchema),
    controller.start,
  );
  router.get('/try-on/jobs/:id', ...auth, ...(limits.poll ?? []), controller.get);
  router.get('/try-on/jobs/:id/image', ...auth, controller.file('image'));
  router.get('/try-on/jobs/:id/model', ...auth, controller.file('model'));
  router.delete('/try-on/jobs/:id', ...auth, controller.remove);

  router.get('/try-on/avatars/:department', ...auth, controller.avatar);
  router.post(
    '/try-on/drapes',
    ...auth,
    ...(limits.drape ?? []),
    validateBody(startDrapeRequestSchema),
    controller.startDrape,
  );
  router.get('/try-on/drapes/:id/image', ...auth, controller.drapeImage);
  router.post('/try-on/drapes/:id/views/:view', ...auth, ...(limits.drapeView ?? []), controller.drapeView);
  router.delete('/try-on/drapes/:id', ...auth, controller.removeDrape);
  return router;
}
