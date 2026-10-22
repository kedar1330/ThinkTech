import type { RequestHandler } from 'express';
import type { ConfirmAppearanceRequest, UpdateAppearanceRequest } from '@styleme/contracts';
import type { AppearanceService } from '../services/appearance.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request is scoped to the authenticated user's own signals. */
export class AppearanceController {
  constructor(private readonly appearance: AppearanceService) {}

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.appearance.get(req.auth.user._id));
  };

  update: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.appearance.update(req.auth.user._id, req.body as UpdateAppearanceRequest));
  };

  confirm: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.appearance.confirm(req.auth.user._id, req.body as ConfirmAppearanceRequest));
  };
}
