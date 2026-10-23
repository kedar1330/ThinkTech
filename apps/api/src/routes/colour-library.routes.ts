import { Router, type RequestHandler } from 'express';
import { updateColourPreferencesRequestSchema } from '@styleme/contracts';
import type { ColourLibraryController } from '../controllers/colour-library.controller';
import { validateBody } from '../middleware/validate';

// /v1/colours/* (API.md §3.13, D-133). Pipeline: route → authentication → validation → controller → service.
export function colourLibraryRoutes(controller: ColourLibraryController, auth: RequestHandler[]): Router {
  const router = Router();
  // Only the user's own skin tone × undertone category; there is no endpoint that lists the others.
  router.get('/colours/mine', ...auth, controller.mine);
  // Coordinating colours and curated combinations from the user's own category (#105).
  router.get('/colours/combinations', ...auth, controller.combinations);
  router.get('/colours/preferences', ...auth, controller.getPreferences);
  router.put(
    '/colours/preferences',
    ...auth,
    validateBody(updateColourPreferencesRequestSchema),
    controller.updatePreferences,
  );
  return router;
}
