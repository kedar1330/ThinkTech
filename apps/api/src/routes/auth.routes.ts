import { Router } from 'express';
import {
  changePasswordRequestSchema,
  deleteAccountRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetConfirmRequestSchema,
  resetRequestRequestSchema,
} from '@styleme/contracts';
import type { AuthController } from '../controllers/auth.controller';
import type { AuthRateLimits } from '../middleware/rate-limit';
import { validateBody } from '../middleware/validate';
import type { RequestHandler } from 'express';

// /v1/auth/* and /v1/account (API.md §3.1). Pipeline: route → rate limit / authentication →
// validation → controller → service.
export function authRoutes(controller: AuthController, auth: RequestHandler, limits: AuthRateLimits): Router {
  const router = Router();

  router.post('/auth/register', limits.register, validateBody(registerRequestSchema), controller.register);
  router.post('/auth/login', limits.login, validateBody(loginRequestSchema), controller.login);
  router.get('/auth/me', auth, controller.me);
  router.post('/auth/logout', auth, limits.logout, controller.logout);
  router.put(
    '/auth/password',
    auth,
    limits.changePassword,
    validateBody(changePasswordRequestSchema),
    controller.changePassword,
  );
  router.post(
    '/auth/password-reset/confirm',
    limits.resetConfirm,
    validateBody(resetConfirmRequestSchema),
    controller.confirmReset,
  );
  router.post(
    '/auth/password-reset/request',
    limits.resetRequestByIp,
    validateBody(resetRequestRequestSchema),
    limits.resetRequestByEmail,
    controller.requestReset,
  );
  router.delete(
    '/account',
    auth,
    limits.deleteAccount,
    validateBody(deleteAccountRequestSchema),
    controller.deleteAccount,
  );

  return router;
}
