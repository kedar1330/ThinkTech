import type { Request, Response } from 'express';
import {
  adminCatalogueTypeSchema,
  adminCreateAdminSchema,
  adminUpdateAdminSchema,
  adminUpdateCatalogueStatusSchema,
  adminUpdateUserStatusSchema,
} from '@styleme/contracts';
import type { AdminService } from '../services/admin.service';
import { AppError } from '../utils/errors';
import { sendData } from '../utils/respond';

export class AdminController {
  constructor(private readonly service: AdminService) {}

  me = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const me = await this.service.getAdminMe(req.auth.user._id);
    sendData(res, me);
  };

  dashboard = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getDashboard();
    sendData(res, data);
  };

  getAdmins = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getAdmins();
    sendData(res, data);
  };

  createAdmin = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const parsed = adminCreateAdminSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('INVALID_REQUEST');
    const result = await this.service.createAdmin(req.auth.user._id, parsed.data);
    sendData(res, result, 201);
  };

  updateAdmin = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) throw new AppError('INVALID_REQUEST');
    const parsed = adminUpdateAdminSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('INVALID_REQUEST');
    const result = await this.service.updateAdmin(req.auth.user._id, id, parsed.data);
    sendData(res, result);
  };

  getUsers = async (req: Request, res: Response): Promise<void> => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const data = await this.service.getUsers(search, page, limit);
    sendData(res, data);
  };

  setUserStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    if (!id) throw new AppError('INVALID_REQUEST');
    const parsed = adminUpdateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError('INVALID_REQUEST');
    const result = await this.service.setUserStatus(req.auth.user._id, id, parsed.data.isActive, parsed.data.reason);
    sendData(res, result);
  };

  getCatalogue = async (req: Request, res: Response): Promise<void> => {
    const rawType = typeof req.query.type === 'string' ? req.query.type : undefined;
    const typeParsed = rawType ? adminCatalogueTypeSchema.safeParse(rawType) : undefined;
    const type = typeParsed?.success ? typeParsed.data : undefined;
    const data = await this.service.getCatalogue(type);
    sendData(res, data);
  };

  updateCatalogueStatus = async (req: Request, res: Response): Promise<void> => {
    if (!req.auth) throw new AppError('UNAUTHENTICATED');
    const rawType = typeof req.params.type === 'string' ? req.params.type : '';
    const id = typeof req.params.id === 'string' ? req.params.id : '';
    const typeParsed = adminCatalogueTypeSchema.safeParse(rawType);
    if (!typeParsed.success || !id) throw new AppError('INVALID_REQUEST');
    const bodyParsed = adminUpdateCatalogueStatusSchema.safeParse(req.body);
    if (!bodyParsed.success) throw new AppError('INVALID_REQUEST');
    const result = await this.service.updateCatalogueStatus(
      req.auth.user._id,
      typeParsed.data,
      id,
      bodyParsed.data.status,
    );
    sendData(res, result);
  };

  getAuditLogs = async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const data = await this.service.getAuditLogs(page, limit);
    sendData(res, data);
  };
}
