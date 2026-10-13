import type { RequestHandler } from 'express';
import type { UpdateProfileRequest } from '@styleme/contracts';
import type { ProfileService } from '../services/profile.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request reads or changes only the authenticated user's own profile (FR-PROF-06). */
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.profiles.get(req.auth.user._id));
  };

  update: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.profiles.update(req.auth.user._id, req.body as UpdateProfileRequest));
  };
}
