import type { RequestHandler } from 'express';
import { hasAdminPermission, type AdminPermission, type AdminRole } from '@styleme/contracts';
import type { Models } from '../models';
import { AppError } from '../utils/errors';

/**
 * Ensures the authenticated user has role 'admin', an active adminAccounts record,
 * and the required permission (FR-ADM-01).
 */
export function requireAdminPermission(models: Models, permission?: AdminPermission): RequestHandler {
  return async (req, _res, next) => {
    if (!req.auth) {
      throw new AppError('UNAUTHENTICATED');
    }

    if (req.auth.user.role !== 'admin') {
      throw new AppError('FORBIDDEN');
    }

    let admin = await models.AdminAccount.findOne({ userId: req.auth.user._id }).lean();
    if (!admin) {
      // Auto-provision Super Admin for the first / existing system admin
      const created = await models.AdminAccount.create({
        userId: req.auth.user._id,
        role: 'super_admin',
        status: 'active',
        lastLoginAt: new Date(),
      });
      admin = created.toObject();
    }

    if (!admin || admin.status !== 'active') {
      throw new AppError('FORBIDDEN');
    }

    const role = admin.role as AdminRole;
    const customPermissions = (admin.permissions as AdminPermission[]) ?? [];
    if (permission && !hasAdminPermission(role, permission, customPermissions)) {
      throw new AppError('FORBIDDEN');
    }

    next();
  };
}
