import type { RequestHandler } from 'express';
import type { UpdateColourPreferencesRequest } from '@styleme/contracts';
import type { ColourLibraryService } from '../services/colour-library.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request is scoped to the authenticated user's own category and colours. */
export class ColourLibraryController {
  constructor(private readonly colours: ColourLibraryService) {}

  private user(req: Parameters<RequestHandler>[0]) {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    return req.auth.user._id;
  }

  mine: RequestHandler = async (req, res) => {
    sendData(res, await this.colours.mine(this.user(req)));
  };

  combinations: RequestHandler = async (req, res) => {
    sendData(res, await this.colours.combinations(this.user(req)));
  };

  getPreferences: RequestHandler = async (req, res) => {
    sendData(res, await this.colours.getPreferences(this.user(req)));
  };

  updatePreferences: RequestHandler = async (req, res) => {
    sendData(res, await this.colours.updatePreferences(this.user(req), req.body as UpdateColourPreferencesRequest));
  };
}
