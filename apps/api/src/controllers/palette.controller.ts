import type { RequestHandler } from 'express';
import type { PaletteListQuery } from '@styleme/contracts';
import type { PaletteService } from '../services/palette.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: suggestions use the authenticated user's own preferences and signals. */
export class PaletteController {
  constructor(private readonly palettes: PaletteService) {}

  list: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.palettes.list(req.auth.user._id, res.locals.query as PaletteListQuery));
  };
}
