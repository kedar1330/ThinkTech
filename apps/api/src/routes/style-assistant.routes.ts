import { Router, type RequestHandler } from 'express';
import { chatDesignRequestSchema, chatMessageRequestSchema } from '@styleme/contracts';
import type { StyleAssistantController } from '../controllers/style-assistant.controller';
import type { Limits } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';

export interface StyleAssistantRateLimits {
  /** Each message may be two Gemini calls and a feature run (D-136). */
  message?: Limits;
  /** A design from the chat is a Design Studio design: a Gemini call and an image generation. */
  design?: Limits;
}

// /v1/chat (API.md §3.9d, D-136). Pipeline: route → authentication → rate limit → validation → controller →
// service. The `:id` is checked in the service.
export function styleAssistantRoutes(
  controller: StyleAssistantController,
  auth: RequestHandler[],
  limits: StyleAssistantRateLimits = {},
): Router {
  const router = Router();
  router.get('/chat', ...auth, controller.overview);
  router.post('/chat', ...auth, ...(limits.message ?? []), validateBody(chatMessageRequestSchema), controller.send);
  router.post(
    '/chat/design',
    ...auth,
    ...(limits.design ?? []),
    validateBody(chatDesignRequestSchema),
    controller.design,
  );
  router.get('/chat/conversations/:id', ...auth, controller.get);
  router.delete('/chat/conversations/:id', ...auth, controller.remove);
  router.delete('/chat/conversations', ...auth, controller.removeAll);
  return router;
}
