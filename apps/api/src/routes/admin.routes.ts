import { Router, type RequestHandler } from 'express';
import type { Models } from '../models';
import type { AdminController } from '../controllers/admin.controller';
import { requireAdminPermission } from '../middleware/admin';

export function adminRoutes(controller: AdminController, auth: RequestHandler[], models: Models): Router {
  const router = Router();

  const adminAuth = (permission?: Parameters<typeof requireAdminPermission>[1]) => [
    ...auth,
    requireAdminPermission(models, permission),
  ];

  router.get('/admin/me', ...adminAuth(), controller.me);
  router.get('/admin/dashboard', ...adminAuth('dashboard.view'), controller.dashboard);
  router.get('/admin/users', ...adminAuth('users.view_limited'), controller.getUsers);
  router.post('/admin/users/:id/status', ...adminAuth('users.suspend'), controller.setUserStatus);
  router.get('/admin/catalogue', ...adminAuth('catalogue.edit'), controller.getCatalogue);
  router.post('/admin/catalogue/:type/:id/status', ...adminAuth('catalogue.publish'), controller.updateCatalogueStatus);
  router.get('/admin/admins', ...adminAuth('admins.manage'), controller.getAdmins);
  router.post('/admin/admins', ...adminAuth('admins.manage'), controller.createAdmin);
  router.patch('/admin/admins/:id', ...adminAuth('admins.manage'), controller.updateAdmin);
  router.post('/admin/admins/:id', ...adminAuth('admins.manage'), controller.updateAdmin);
  router.get('/admin/audit-logs', ...adminAuth('audit.view'), controller.getAuditLogs);

  return router;
}
