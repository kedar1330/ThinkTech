import type { RequestHandler } from 'express';
import type { UploadPhotoQuery } from '@styleme/contracts';
import type { PhotoService } from '../services/photo.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

/** HTTP only: every request reads or changes only the authenticated user's own photos. */
export class PhotosController {
  constructor(private readonly photos: PhotoService) {}

  list: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.photos.list(req.auth.user._id));
  };

  /** The body is the raw image (`express.raw`); the kind and notice version come in the query. */
  upload: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const query = res.locals.query as UploadPhotoQuery;
    sendData(res, await this.photos.upload(req.auth.user._id, query, bytes), 201);
  };

  /** The raw image of the user's own photo; never cached by the browser or any proxy. */
  image: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const { data, contentType } = await this.photos.image(req.auth.user._id, String(req.params.id));
    res.set({ 'content-type': contentType, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
    res.send(data);
  };

  remove: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.photos.remove(req.auth.user._id, String(req.params.id));
    sendData(res, { deleted: true });
  };
}
