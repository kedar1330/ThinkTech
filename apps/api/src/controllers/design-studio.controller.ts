import type { RequestHandler } from 'express';
import type { DesignStudioService } from '../services/design-studio.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request reads or changes only the authenticated user's own designs. */
export class DesignStudioController {
  constructor(private readonly studio: DesignStudioService) {}

  overview: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.studio.overview(req.auth.user._id));
  };

  create: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.studio.create(req.auth.user._id, req.body), 201);
  };

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.studio.get(req.auth.user._id, String(req.params.id)));
  };

  render: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.studio.render(req.auth.user._id, String(req.params.id)));
  };

  /** The generated picture (`?which=design`, default) or the user's own sketch (`?which=source`); never cached. */
  image: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const which = req.query.which === 'source' ? 'source' : 'design';
    const { data, contentType } = await this.studio.image(req.auth.user._id, String(req.params.id), which);
    res.set({ 'content-type': contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
    res.send(data);
  };

  remove: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.studio.remove(req.auth.user._id, String(req.params.id));
    sendData(res, { deleted: true });
  };
}
