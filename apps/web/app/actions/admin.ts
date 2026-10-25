'use server';

import { revalidatePath } from 'next/cache';
import type {
  AdminAuditLogsResponse,
  AdminCatalogueResponse,
  AdminCatalogueType,
  AdminCreateAdminRequest,
  AdminDashboardResponse,
  AdminListItem,
  AdminListResponse,
  AdminMeResponse,
  AdminUpdateAdminRequest,
  AdminUsersResponse,
} from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { sameOrigin, tokenOrLogin } from '@/lib/actions';

export async function getAdminMeAction(): Promise<{ data?: AdminMeResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const data = await apiRequest<AdminMeResponse>('/v1/admin/me', { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load admin profile' };
  }
}

export async function getAdminDashboardAction(): Promise<{ data?: AdminDashboardResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const data = await apiRequest<AdminDashboardResponse>('/v1/admin/dashboard', { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load dashboard' };
  }
}

export async function getAdminUsersAction(
  search?: string,
  page = 1,
): Promise<{ data?: AdminUsersResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (page > 1) query.set('page', String(page));
    const qs = query.toString();
    const data = await apiRequest<AdminUsersResponse>(`/v1/admin/users${qs ? `?${qs}` : ''}`, { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load users' };
  }
}

export async function setAdminUserStatusAction(
  userId: string,
  isActive: boolean,
  reason?: string,
): Promise<{ success?: boolean; error?: string }> {
  if (!(await sameOrigin())) return { error: 'Request blocked' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/admin/users/${userId}/status`, {
      method: 'POST',
      token,
      body: { isActive, reason },
    });
    revalidatePath('/admin/users');
    revalidatePath('/admin/audit');
    revalidatePath('/admin');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update user status' };
  }
}

export async function getAdminCatalogueAction(
  type?: AdminCatalogueType,
): Promise<{ data?: AdminCatalogueResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const qs = type ? `?type=${type}` : '';
    const data = await apiRequest<AdminCatalogueResponse>(`/v1/admin/catalogue${qs}`, { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load catalogue' };
  }
}

export async function setAdminCatalogueStatusAction(
  type: AdminCatalogueType,
  id: string,
  status: 'draft' | 'published' | 'archived',
): Promise<{ success?: boolean; error?: string }> {
  if (!(await sameOrigin())) return { error: 'Request blocked' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/admin/catalogue/${type}/${id}/status`, {
      method: 'POST',
      token,
      body: { status },
    });
    revalidatePath('/admin/catalogue');
    revalidatePath('/admin/audit');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update catalogue item' };
  }
}

export async function getAdminAuditLogsAction(page = 1): Promise<{ data?: AdminAuditLogsResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const data = await apiRequest<AdminAuditLogsResponse>(`/v1/admin/audit-logs?page=${page}`, { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load audit logs' };
  }
}

export async function getAdminsAction(): Promise<{ data?: AdminListResponse; error?: string }> {
  const token = await tokenOrLogin();
  try {
    const data = await apiRequest<AdminListResponse>('/v1/admin/admins', { token });
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to load admins list' };
  }
}

export async function createAdminAction(
  input: AdminCreateAdminRequest,
): Promise<{ data?: AdminListItem; error?: string }> {
  if (!(await sameOrigin())) return { error: 'Request blocked' };
  const token = await tokenOrLogin();
  try {
    const data = await apiRequest<AdminListItem>('/v1/admin/admins', {
      method: 'POST',
      token,
      body: input,
    });
    revalidatePath('/admin/admins');
    revalidatePath('/admin/audit');
    return { data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create admin' };
  }
}

export async function updateAdminAction(
  id: string,
  input: AdminUpdateAdminRequest,
): Promise<{ success?: boolean; error?: string }> {
  if (!(await sameOrigin())) return { error: 'Request blocked' };
  const token = await tokenOrLogin();
  try {
    await apiRequest(`/v1/admin/admins/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    });
    revalidatePath('/admin/admins');
    revalidatePath('/admin/audit');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update admin' };
  }
}
