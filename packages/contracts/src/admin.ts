import { z } from 'zod';

// Admin panel (FRD §4.23, DATABASE.md §4b, decision D-120). Specified 2026-10-18; no endpoint uses these
// yet. Every permission is enforced by the API; the admin UI only hides what the role cannot do.

export const ADMIN_ROLES = ['super_admin', 'content_admin'] as const;
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

/** Role → permissions. A Content Admin never manages admins, users, security or styling approval. */
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
};

export function hasAdminPermission(role: AdminRole, permission: AdminPermission): boolean {
  return ADMIN_ROLE_PERMISSIONS[role].includes(permission);
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
