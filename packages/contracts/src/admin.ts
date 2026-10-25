import { z } from 'zod';

// Admin panel (FRD §4.23, DATABASE.md §4b, decision D-120). Specified 2026-10-18; no endpoint uses these
// yet. Every permission is enforced by the API; the admin UI only hides what the role cannot do.

export const ADMIN_ROLES = ['super_admin', 'content_admin', 'custom_admin'] as const;
export const adminRoleSchema = z.enum(ADMIN_ROLES);
export type AdminRole = z.infer<typeof adminRoleSchema>;

export const ADMIN_STATUSES = ['active', 'disabled'] as const;
export const adminStatusSchema = z.enum(ADMIN_STATUSES);

export const ADMIN_PERMISSIONS = [
  'dashboard.view',
  'stats.view',
  'catalogue.edit', // create and edit drafts of categories, attributes, styles, palettes, templates, illustrations
  'catalogue.publish', // publish, unpublish and archive records that are already founder-approved (D-62)
  'catalogue.approve_styling', // record founder approval of styling content (D-62)
  'products.manage', // authorised product records only (D-43 … D-45)
  'reports.review',
  'tryon.monitor',
  'users.view_limited', // account status, registration date, identifiers — never profiles, photos or measurements
  'users.suspend',
  'users.request_deletion',
  'audit.view',
  'admins.manage',
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];
export const adminPermissionSchema = z.enum(ADMIN_PERMISSIONS);

export interface AdminPermissionDefinition {
  id: AdminPermission;
  label: string;
  category: 'Dashboard & Stats' | 'Catalogue & Content' | 'Users & Moderation' | 'Security & Administration';
  description: string;
}

export const ADMIN_PERMISSION_DEFINITIONS: readonly AdminPermissionDefinition[] = [
  {
    id: 'dashboard.view',
    label: 'View Dashboard',
    category: 'Dashboard & Stats',
    description: 'Inspect platform health, overview metrics, and system activity.',
  },
  {
    id: 'stats.view',
    label: 'View Analytics',
    category: 'Dashboard & Stats',
    description: 'Access aggregate usage metrics, trends, and engagement statistics.',
  },
  {
    id: 'catalogue.edit',
    label: 'Edit Catalogue',
    category: 'Catalogue & Content',
    description: 'Draft and edit categories, clothing styles, palettes, and outfit templates.',
  },
  {
    id: 'catalogue.publish',
    label: 'Publish Catalogue',
    category: 'Catalogue & Content',
    description: 'Publish, unpublish, and archive styling content live in the app.',
  },
  {
    id: 'catalogue.approve_styling',
    label: 'Approve Styling Rules',
    category: 'Catalogue & Content',
    description: 'Grant founder approval on styling rules and algorithm datasets.',
  },
  {
    id: 'products.manage',
    label: 'Manage Products',
    category: 'Catalogue & Content',
    description: 'Curate retail product links and Shop My Look affiliate records.',
  },
  {
    id: 'reports.review',
    label: 'Review Reports',
    category: 'Users & Moderation',
    description: 'Investigate and resolve user-submitted feedback and product reports.',
  },
  {
    id: 'tryon.monitor',
    label: 'Monitor 3D Try-On',
    category: 'Dashboard & Stats',
    description: 'Track GPU queue status, try-on job health, and failure rates.',
  },
  {
    id: 'users.view_limited',
    label: 'View Users (Privacy-Safe)',
    category: 'Users & Moderation',
    description: 'View user accounts, join dates, and status without accessing private photos or measurements.',
  },
  {
    id: 'users.suspend',
    label: 'Suspend / Reactivate Users',
    category: 'Users & Moderation',
    description: 'Block violating accounts and immediately invalidate all active sessions.',
  },
  {
    id: 'users.request_deletion',
    label: 'Request User Deletion',
    category: 'Users & Moderation',
    description: 'Initiate account tombstoning and GDPR-compliant erasure queues.',
  },
  {
    id: 'audit.view',
    label: 'View Audit Logs',
    category: 'Security & Administration',
    description: 'Inspect the immutable 1-year administrative audit trail and action history.',
  },
  {
    id: 'admins.manage',
    label: 'Manage Admins & Restrictions',
    category: 'Security & Administration',
    description: 'Add new admins, set granular restrictions, and revoke admin privileges.',
  },
] as const;

/** Role → permissions default mapping. Super admin has everything; content admin curates catalogue. */
export const ADMIN_ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ADMIN_PERMISSIONS,
  content_admin: [
    'dashboard.view',
    'stats.view',
    'catalogue.edit',
    'catalogue.publish',
    'products.manage',
    'reports.review',
    'tryon.monitor',
  ],
  custom_admin: ['dashboard.view'],
};

export function getAdminEffectivePermissions(
  role: AdminRole,
  customPermissions?: readonly AdminPermission[],
): readonly AdminPermission[] {
  if (role === 'super_admin') {
    return ADMIN_PERMISSIONS;
  }
  if (role === 'content_admin') {
    return customPermissions && customPermissions.length > 0 ? customPermissions : ADMIN_ROLE_PERMISSIONS.content_admin;
  }
  return customPermissions && customPermissions.length > 0 ? customPermissions : ADMIN_ROLE_PERMISSIONS.custom_admin;
}

export function hasAdminPermission(
  role: AdminRole,
  permission: AdminPermission,
  customPermissions?: readonly AdminPermission[],
): boolean {
  return getAdminEffectivePermissions(role, customPermissions).includes(permission);
}

// --- Audit log ------------------------------------------------------------------------------------------

export const AUDIT_TARGET_TYPES = [
  'user',
  'admin',
  'catalogue_category',
  'garment_attribute',
  'clothing_style',
  'styling_rule',
  'fabric_rule',
  'palette',
  'outfit_template',
  'illustration',
  'product',
  'retailer',
  'product_report',
] as const;
export const auditTargetTypeSchema = z.enum(AUDIT_TARGET_TYPES);

export const AUDIT_ACTIONS = [
  'CREATED',
  'UPDATED',
  'APPROVED',
  'PUBLISHED',
  'UNPUBLISHED',
  'ARCHIVED',
  'RESTORED',
  'USER_SUSPENDED',
  'USER_REACTIVATED',
  'USER_DELETION_REQUESTED',
  'ADMIN_ROLE_CHANGED',
  'ADMIN_DISABLED',
  'ADMIN_ENABLED',
  'REPORT_REVIEWED',
] as const;
export const auditActionSchema = z.enum(AUDIT_ACTIONS);

export const AUDIT_STATUSES = ['success', 'failure'] as const;

/**
 * A sanitised change summary: field names, and values only for non-personal catalogue fields. Never
 * passwords, tokens, photos, image URLs of user media, measurements or profile values (SECURITY.md §9).
 */
export const auditChangeSchema = z
  .object({
    field: z.string().min(1).max(80),
    from: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]).optional(),
    to: z.union([z.string().max(200), z.number(), z.boolean(), z.null()]).optional(),
  })
  .strict();

/** Aggregates with fewer members than this are shown as "fewer than 10" (D-125). */
export const SMALL_GROUP_THRESHOLD = 10;

// --- Admin API Contracts --------------------------------------------------------------------------------

export interface AdminMeResponse {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  permissions: readonly AdminPermission[];
}

export interface AdminDashboardStats {
  totalUsers: number;
  newUsersLast7Days: number;
  activeUsers: number;
  totalStyles: number;
  totalCategories: number;
  totalPalettes: number;
  totalOutfitTemplates: number;
  totalTryOnJobs: number;
}

export interface AdminDashboardAttention {
  draftsAwaitingApproval: number;
  missingIllustrations: number;
  openProductReports: number;
}

export interface AdminDashboardResponse {
  stats: AdminDashboardStats;
  attention: AdminDashboardAttention;
}

export interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  isActive: boolean;
  emailVerified: boolean;
  city: string | null;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminUserItem[];
  total: number;
}

export const adminUpdateUserStatusSchema = z
  .object({
    isActive: z.boolean(),
    reason: z.string().trim().max(200).optional(),
  })
  .strict();
export type AdminUpdateUserStatusRequest = z.infer<typeof adminUpdateUserStatusSchema>;

export const ADMIN_CATALOGUE_TYPES = ['category', 'style', 'palette', 'template'] as const;
export const adminCatalogueTypeSchema = z.enum(ADMIN_CATALOGUE_TYPES);
export type AdminCatalogueType = z.infer<typeof adminCatalogueTypeSchema>;

export interface AdminCatalogueItem {
  id: string;
  type: AdminCatalogueType;
  name: string;
  status: 'draft' | 'published' | 'archived';
  updatedAt: string;
}

export interface AdminCatalogueResponse {
  items: AdminCatalogueItem[];
  total: number;
}

export const adminUpdateCatalogueStatusSchema = z
  .object({
    status: z.enum(['draft', 'published', 'archived']),
  })
  .strict();
export type AdminUpdateCatalogueStatusRequest = z.infer<typeof adminUpdateCatalogueStatusSchema>;

export interface AdminAuditLogItem {
  id: string;
  adminId: string;
  action: (typeof AUDIT_ACTIONS)[number];
  targetType: (typeof AUDIT_TARGET_TYPES)[number];
  targetId: string;
  status: (typeof AUDIT_STATUSES)[number];
  changes: Array<{ field: string; from?: string | number | boolean | null; to?: string | number | boolean | null }>;
  at: string;
}

export interface AdminAuditLogsResponse {
  logs: AdminAuditLogItem[];
  total: number;
}

// --- Admin Management (Admins & Permissions) -------------------------------------------------------------

export interface AdminListItem {
  id: string; // adminAccount._id
  userId: string;
  email: string;
  name: string;
  role: AdminRole;
  status: 'active' | 'disabled';
  permissions: readonly AdminPermission[];
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminListResponse {
  admins: AdminListItem[];
  total: number;
}

export const adminCreateAdminSchema = z
  .object({
    email: z.string().trim().email(),
    name: z.string().trim().min(1).max(80).optional(),
    password: z.string().min(8).optional(),
    role: adminRoleSchema,
    permissions: z.array(adminPermissionSchema).optional(),
  })
  .strict();
export type AdminCreateAdminRequest = z.infer<typeof adminCreateAdminSchema>;

export const adminUpdateAdminSchema = z
  .object({
    role: adminRoleSchema.optional(),
    permissions: z.array(adminPermissionSchema).optional(),
    status: adminStatusSchema.optional(),
  })
  .strict();
export type AdminUpdateAdminRequest = z.infer<typeof adminUpdateAdminSchema>;

/**
 * Human-readable explanations for audit log actions.
 * Clarifies to admins and auditors exactly what each logged event was for (FR-ADM-09).
 */
export const AUDIT_ACTION_PURPOSES: Record<
  (typeof AUDIT_ACTIONS)[number],
  { title: string; purpose: string; badgeVariant: 'default' | 'destructive' | 'warning' | 'success' }
> = {
  ADMIN_ROLE_CHANGED: {
    title: 'Admin Restrictions Configured',
    purpose: 'Updated administrative role and capability permissions.',
    badgeVariant: 'warning',
  },
  ADMIN_DISABLED: {
    title: 'Admin Account Disabled',
    purpose: 'Revoked administrative privileges and restricted access.',
    badgeVariant: 'destructive',
  },
  ADMIN_ENABLED: {
    title: 'Admin Account Enabled',
    purpose: 'Reactivated administrative privileges and restored system access.',
    badgeVariant: 'success',
  },
  USER_SUSPENDED: {
    title: 'User Suspended',
    purpose: 'Suspended user account and immediately revoked active sessions for safety/compliance.',
    badgeVariant: 'destructive',
  },
  USER_REACTIVATED: {
    title: 'User Reactivated',
    purpose: 'Restored user account access and allowed new logins.',
    badgeVariant: 'success',
  },
  USER_DELETION_REQUESTED: {
    title: 'Deletion Requested',
    purpose: 'Initiated privacy erasure workflow for user data under GDPR.',
    badgeVariant: 'destructive',
  },
  PUBLISHED: {
    title: 'Catalogue Published',
    purpose: 'Made catalogue category, style, or template live for users.',
    badgeVariant: 'success',
  },
  UNPUBLISHED: {
    title: 'Catalogue Unpublished',
    purpose: 'Withdrew item from live users for review or updates.',
    badgeVariant: 'warning',
  },
  ARCHIVED: {
    title: 'Catalogue Archived',
    purpose: 'Retired outdated catalogue records.',
    badgeVariant: 'default',
  },
  RESTORED: {
    title: 'Catalogue Restored',
    purpose: 'Restored archived catalogue item to active state.',
    badgeVariant: 'success',
  },
  CREATED: {
    title: 'Resource Created',
    purpose: 'Created new system entity or admin account.',
    badgeVariant: 'success',
  },
  UPDATED: {
    title: 'Resource Updated',
    purpose: 'Modified attributes or settings on a system resource.',
    badgeVariant: 'default',
  },
  APPROVED: {
    title: 'Founder Approved',
    purpose: 'Recorded founder verification on styling or platform rules.',
    badgeVariant: 'success',
  },
  REPORT_REVIEWED: {
    title: 'Report Reviewed',
    purpose: 'Investigated and marked user report as processed.',
    badgeVariant: 'default',
  },
};
