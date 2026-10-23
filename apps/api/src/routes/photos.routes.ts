import express, { Router, type RequestHandler } from 'express';
import { PHOTO_CONTENT_TYPES, PHOTO_MAX_BYTES, uploadPhotoQuerySchema } from '@styleme/contracts';
import type { PhotosController } from '../controllers/photos.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateQuery } from '../middleware/validate';
import { AppError } from '../utils/errors';

// /v1/photos (API.md §3.9a, D-129). Pipeline: route → authentication → rate limit → query validation →
// raw image body (JPEG, PNG or WebP, at most 8 MB) → controller → service. The global JSON parser ignores
// image bodies, so only this route reads them.
export function photosRoutes(controller: PhotosController, auth: RequestHandler[], limits: Limits = []): Router {
  const router = Router();
  const rawImage = express.raw({ type: [...PHOTO_CONTENT_TYPES], limit: PHOTO_MAX_BYTES });
  const imageOnly: RequestHandler = (req, _res, next) => {
    if (!Buffer.isBuffer(req.body))
      throw new AppError('INVALID_REQUEST', 'Choose a JPEG, PNG or WebP photo under 8 MB.');
    next();
  };
  router.get('/photos', ...auth, controller.list);
  router.post(
    '/photos',
    ...auth,
    ...limits,
    validateQuery(uploadPhotoQuerySchema),
    rawImage,
    imageOnly,
    controller.upload,
  );
  router.post('/photos/try-on', ...auth, ...limits, rawImage, imageOnly, controller.uploadTryOn);
  router.get('/photos/:id/image', ...auth, controller.image);
  router.delete('/photos/:id', ...auth, controller.remove);
  return router;
}
