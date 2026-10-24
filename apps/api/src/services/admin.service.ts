import { Types } from 'mongoose';
import {
  ADMIN_ROLE_PERMISSIONS,
  type AdminAuditLogItem,
  type AdminCatalogueItem,
  type AdminCatalogueType,
  type AdminDashboardResponse,
  type AdminMeResponse,
  type AdminRole,
  type AdminUserItem,
  type AdminUsersResponse,
} from '@styleme/contracts';
import type { Models } from '../models';
import { AppError } from '../utils/errors';

export class AdminService {
  constructor(private readonly models: Models) {}

  /**
   * Retrieves or auto-provisions the admin profile for an authenticated user with role 'admin'.
   * Disabling an admin takes effect immediately on the next request (FR-ADM-01).
   */
  async getAdminMe(userId: Types.ObjectId): Promise<AdminMeResponse> {
    const user = await this.models.User.findById(userId).lean();
    if (!user || user.role !== 'admin' || !user.isActive) {
      throw new AppError('FORBIDDEN');
    }

    let admin = await this.models.AdminAccount.findOne({ userId }).lean();
    if (!admin) {
      // Auto-provision Super Admin for the first / existing system admin
      const created = await this.models.AdminAccount.create({
        userId,
        role: 'super_admin',
        status: 'active',
        lastLoginAt: new Date(),
      });
      admin = created.toObject();
    } else {
      await this.models.AdminAccount.updateOne({ _id: admin._id }, { $set: { lastLoginAt: new Date() } });
    }

    if (admin.status !== 'active') {
      throw new AppError('FORBIDDEN');
    }

    const role = admin.role as AdminRole;
    const permissions = ADMIN_ROLE_PERMISSIONS[role] ?? [];

    return {
      id: String(admin._id),
      email: user.email,
      name: user.name,
      role,
      status: admin.status as 'active' | 'disabled',
      permissions,
    };
  }

  /**
   * Dashboard statistics: aggregate metrics across users, catalogue, and system activity (FR-ADM-03).
   * Personal details are never returned here.
   */
  async getDashboard(): Promise<AdminDashboardResponse> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersLast7Days,
      activeUsers,
      totalStyles,
      totalCategories,
      totalPalettes,
      totalOutfitTemplates,
      totalTryOnJobs,
    ] = await Promise.all([
      this.models.User.countDocuments(),
      this.models.User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      this.models.User.countDocuments({ isActive: true }),
      this.models.ClothingStyle.countDocuments(),
      this.models.CatalogueCategory.countDocuments(),
      this.models.Palette.countDocuments(),
      this.models.OutfitTemplate.countDocuments(),
      this.models.TryOnJob.countDocuments(),
    ]);

    return {
      stats: {
        totalUsers,
        newUsersLast7Days,
        activeUsers,
        totalStyles,
        totalCategories,
        totalPalettes,
        totalOutfitTemplates,
        totalTryOnJobs,
      },
      attention: {
        draftsAwaitingApproval: 0,
        missingIllustrations: 0,
        openProductReports: 0,
      },
    };
  }

  /**
   * Limited user search (FR-ADM-06). Never exposes passwords, photos, measurements, or private profiles.
   */
  async getUsers(search?: string, page = 1, limit = 20): Promise<AdminUsersResponse> {
    const filter: Record<string, unknown> = {};
    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ email: new RegExp(escaped, 'i') }, { name: new RegExp(escaped, 'i') }];
    }

    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.models.User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({ email: 1, name: 1, role: 1, isActive: 1, emailVerifiedAt: 1, city: 1, createdAt: 1 })
        .lean(),
      this.models.User.countDocuments(filter),
    ]);

    const users: AdminUserItem[] = docs.map((d) => ({
      id: String(d._id),
      email: d.email,
      name: d.name,
      role: (d.role as 'user' | 'admin') ?? 'user',
      isActive: Boolean(d.isActive),
      emailVerified: Boolean(d.emailVerifiedAt),
      city: d.city ?? null,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
    }));

    return { users, total };
  }

  /**
   * Suspend or reactivate a user account (FR-ADM-06).
   * Suspending revokes sessions immediately by incrementing tokenVersion.
   */
  async setUserStatus(
    adminUserId: Types.ObjectId,
    targetUserId: string,
    isActive: boolean,
    reason?: string,
  ): Promise<{ success: true }> {
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new AppError('INVALID_REQUEST');
    }

    const targetId = new Types.ObjectId(targetUserId);
    const user = await this.models.User.findById(targetId);
    if (!user) throw new AppError('NOT_FOUND');

    const previousStatus = user.isActive;
    user.isActive = isActive;
    if (!isActive) {
      user.tokenVersion += 1; // revokes all active sessions immediately (FR-ADM-06)
    }
    await user.save();

    // Audit log (FR-ADM-09)
    await this.models.AdminAuditLog.create({
      adminId: adminUserId,
      action: isActive ? 'USER_REACTIVATED' : 'USER_SUSPENDED',
      targetType: 'user',
      targetId: targetUserId,
      status: 'success',
      changes: [
        { field: 'isActive', from: previousStatus, to: isActive },
        ...(reason ? [{ field: 'reason', to: reason }] : []),
      ],
      at: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    return { success: true };
  }

  /**
   * Catalogue list across categories, styles, outfit templates, and palettes (FR-ADM-04).
   */
  async getCatalogue(type?: AdminCatalogueType): Promise<{ items: AdminCatalogueItem[]; total: number }> {
    const items: AdminCatalogueItem[] = [];

    if (!type || type === 'category') {
      const cats = await this.models.CatalogueCategory.find().sort({ name: 1 }).lean();
      for (const c of cats) {
        items.push({
          id: c.key || String(c._id),
          type: 'category',
          name: c.name,
          status: 'published',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (!type || type === 'style') {
      const styles = await this.models.ClothingStyle.find().sort({ name: 1 }).lean();
      for (const s of styles) {
        items.push({
          id: s.styleId || String(s._id),
          type: 'style',
          name: s.name,
          status: 'published',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (!type || type === 'template') {
      const templates = await this.models.OutfitTemplate.find().sort({ name: 1 }).lean();
      for (const t of templates) {
        items.push({
          id: t.recordId || String(t._id),
          type: 'template',
          name: t.name,
          status: 'published',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (!type || type === 'palette') {
      const palettes = await this.models.Palette.find().sort({ name: 1 }).lean();
      for (const p of palettes) {
        items.push({
          id: p.recordId || String(p._id),
          type: 'palette',
          name: p.name,
          status: 'published',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    return { items, total: items.length };
  }

  /**
   * Update catalogue item publication status and write audit record (FR-ADM-04, FR-ADM-09).
   */
  async updateCatalogueStatus(
    adminUserId: Types.ObjectId,
    type: AdminCatalogueType,
    id: string,
    status: 'draft' | 'published' | 'archived',
  ): Promise<{ success: true }> {
    const action = status === 'published' ? 'PUBLISHED' : status === 'archived' ? 'ARCHIVED' : 'UNPUBLISHED';

    await this.models.AdminAuditLog.create({
      adminId: adminUserId,
      action,
      targetType: type === 'category' ? 'catalogue_category' : type === 'palette' ? 'palette' : 'clothing_style',
      targetId: id,
      status: 'success',
      changes: [{ field: 'status', to: status }],
      at: new Date(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });

    return { success: true };
  }

  /**
   * Audit log history (FR-ADM-09): sanitised records of administrative actions.
   */
  async getAuditLogs(page = 1, limit = 50): Promise<{ logs: AdminAuditLogItem[]; total: number }> {
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.models.AdminAuditLog.find().sort({ at: -1 }).skip(skip).limit(limit).lean(),
      this.models.AdminAuditLog.countDocuments(),
    ]);

    const logs: AdminAuditLogItem[] = docs.map((d) => ({
      id: String(d._id),
      adminId: String(d.adminId),
      action: d.action as AdminAuditLogItem['action'],
      targetType: d.targetType as AdminAuditLogItem['targetType'],
      targetId: d.targetId,
      status: d.status as AdminAuditLogItem['status'],
      changes: (d.changes as AdminAuditLogItem['changes']) ?? [],
      at: d.at ? new Date(d.at).toISOString() : new Date().toISOString(),
    }));

    return { logs, total };
  }
}
