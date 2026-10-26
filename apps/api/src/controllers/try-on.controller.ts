import type { RequestHandler } from 'express';
import { avatarDepartmentSchema, drapeViewSchema } from '@styleme/contracts';
import type { DrapeService } from '../services/drape.service';
import type { TryOnService } from '../services/try-on.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

const PRIVATE_FILE = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };

/** HTTP only: every request reads or changes only the authenticated user's own try-ons and dressed avatars. */
export class TryOnController {
  constructor(
    private readonly tryOn: TryOnService,
    private readonly drapes: DrapeService,
  ) {}

  overview: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.tryOn.overview(req.auth.user._id));
  };

  start: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.tryOn.start(req.auth.user._id, req.body), 202);
  };

  get: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.tryOn.get(req.auth.user._id, String(req.params.id)));
  };

  /** The dressed picture (`/image`) or the GLB model (`/model`); never cached. */
  file =
    (which: 'image' | 'model'): RequestHandler =>
    async (req, res) => {
      if (!req.auth) throw new AppError('UNAUTHENTICATED');
      const { data, contentType } = await this.tryOn.file(req.auth.user._id, String(req.params.id), which);
      res.set({ 'content-type': contentType, ...PRIVATE_FILE });
      res.send(data);
    };

  remove: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.tryOn.remove(req.auth.user._id, String(req.params.id));
    sendData(res, { deleted: true });
  };

  /** The undressed model (user's saved profile photo, or shared cartoon avatar). */
  avatar: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const department = avatarDepartmentSchema.safeParse(req.params.department);
    if (!department.success) throw new AppError('NOT_FOUND');
    const { data, contentType } = await this.drapes.avatar(department.data, req.auth.user._id);
    res.set({
      'content-type': contentType,
      'cache-control': 'private, no-cache',
      'x-content-type-options': 'nosniff',
    });
    res.send(data);
  };

  startDrape: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    sendData(res, await this.drapes.start(req.auth.user._id, req.body), 201);
  };

  /** `?view=front|three_quarter|side|back` (default front); a view not drawn yet is 404. */
  drapeImage: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const view = drapeViewSchema.catch('front').parse(req.query.view);
    const { data, contentType } = await this.drapes.image(req.auth.user._id, String(req.params.id), view);
    res.set({ 'content-type': contentType, ...PRIVATE_FILE });
    res.send(data);
  };

  /** Draws one more angle of a dressed model (D-139). */
  drapeView: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const view = drapeViewSchema.exclude(['front']).safeParse(req.params.view);
    if (!view.success) throw new AppError('NOT_FOUND');
    sendData(res, await this.drapes.view(req.auth.user._id, String(req.params.id), view.data));
  };

  removeDrape: RequestHandler = async (req, res) => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    await this.drapes.remove(req.auth.user._id, String(req.params.id));
    sendData(res, { deleted: true });
  };
}
