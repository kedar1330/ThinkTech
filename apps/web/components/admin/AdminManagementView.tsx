'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_PERMISSIONS,
  type AdminListItem,
  type AdminMeResponse,
  type AdminPermission,
  type AdminRole,
} from '@styleme/contracts';
import { createAdminAction, updateAdminAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

interface AdminManagementViewProps {
  initialAdmins: AdminListItem[];
  currentAdmin: AdminMeResponse;
}

export function AdminManagementView({ initialAdmins, currentAdmin }: AdminManagementViewProps) {
  const [admins, setAdmins] = useState<AdminListItem[]>(initialAdmins);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminListItem | null>(null);

  // Form State for Adding / Editing
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('content_admin');
  const [selectedPermissions, setSelectedPermissions] = useState<AdminPermission[]>([
    ...ADMIN_ROLE_PERMISSIONS.content_admin,
  ]);

  // Action Pending State
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canManageAdmins = currentAdmin.permissions.includes('admins.manage') || currentAdmin.role === 'super_admin';

  const filteredAdmins = admins.filter(
    (a) =>
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.role.toLowerCase().includes(search.toLowerCase()),
  );

  const stats = {
    total: admins.length,
    superAdmins: admins.filter((a) => a.role === 'super_admin').length,
    contentAdmins: admins.filter((a) => a.role === 'content_admin').length,
    customAdmins: admins.filter((a) => a.role === 'custom_admin').length,
    active: admins.filter((a) => a.status === 'active').length,
  };

  function openAddModal() {
    setError(null);
    setSuccessMsg(null);
    setEmail('');
    setName('');
    setPassword('');
    setRole('content_admin');
    setSelectedPermissions([...ADMIN_ROLE_PERMISSIONS.content_admin]);
    setIsAddModalOpen(true);
  }

  function openEditModal(admin: AdminListItem) {
    setError(null);
    setSuccessMsg(null);
    setEditingAdmin(admin);
    setRole(admin.role);
    setSelectedPermissions([...admin.permissions]);
  }

  function handleRoleChange(newRole: AdminRole) {
    setRole(newRole);
    if (newRole === 'super_admin') {
      setSelectedPermissions(ADMIN_PERMISSION_DEFINITIONS.map((p) => p.id));
    } else if (newRole === 'content_admin') {
      setSelectedPermissions([...ADMIN_ROLE_PERMISSIONS.content_admin]);
    } else if (newRole === 'custom_admin' && role !== 'custom_admin') {
      // Keep existing selection or default to basic view
      if (selectedPermissions.length === 0) {
        setSelectedPermissions(['dashboard.view']);
      }
    }
  }

  function togglePermission(permId: AdminPermission) {
    if (role === 'super_admin') return; // Super admin always has all permissions
    setSelectedPermissions((prev) => (prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]));
  }

  function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setError(null);
    startTransition(async () => {
      const res = await createAdminAction({
        email: email.trim(),
        name: name.trim() || undefined,
        password: password.trim() || undefined,
        role,
        permissions: role === 'super_admin' ? undefined : selectedPermissions,
      });

      if (res.error || !res.data) {
        setError(res.error ?? 'Failed to create administrator');
      } else {
        setAdmins((prev) => [res.data!, ...prev.filter((a) => a.id !== res.data!.id)]);
        setIsAddModalOpen(false);
        setSuccessMsg(
          `Administrator ${res.data.name} (${res.data.email}) created successfully with role ${res.data.role}.`,
        );
      }
    });
  }

  function handleUpdateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!editingAdmin) return;

    setError(null);
    startTransition(async () => {
      const res = await updateAdminAction(editingAdmin.id, {
        role,
        permissions: role === 'super_admin' ? undefined : selectedPermissions,
      });

      if (res.error) {
        setError(res.error);
      } else {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === editingAdmin.id
              ? {
                  ...a,
                  role,
                  permissions:
                    role === 'super_admin' ? ADMIN_PERMISSION_DEFINITIONS.map((p) => p.id) : selectedPermissions,
                }
              : a,
          ),
        );
        setEditingAdmin(null);
        setSuccessMsg(`Restrictions and role for ${editingAdmin.name} updated successfully.`);
      }
    });
  }

  function handleToggleAdminStatus(admin: AdminListItem) {
    const nextStatus = admin.status === 'active' ? 'disabled' : 'active';
    const confirmMsg =
      nextStatus === 'disabled'
        ? `Disable admin account for ${admin.name} (${admin.email})?\n\nThis will immediately revoke all active sessions and block access to the admin panel.`
        : `Re-enable administrator privileges for ${admin.name} (${admin.email})?`;

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setPendingId(admin.id);

    startTransition(async () => {
      const res = await updateAdminAction(admin.id, { status: nextStatus });
      setPendingId(null);
      if (res.error) {
        setError(res.error);
      } else {
        setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, status: nextStatus } : a)));
        setSuccessMsg(
          `Administrator ${admin.name} has been ${nextStatus === 'disabled' ? 'disabled' : 'reactivated'}.`,
        );
      }
    });
  }

  // Categories of permissions
  const categories: Array<
    'Dashboard & Stats' | 'Catalogue & Content' | 'Users & Moderation' | 'Security & Administration'
  > = ['Dashboard & Stats', 'Catalogue & Content', 'Users & Moderation', 'Security & Administration'];

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Admins</span>
            <Users className="size-4 text-plum" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">{stats.total}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{stats.active} currently active</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Super Admins</span>
            <ShieldAlert className="size-4 text-plum" />
          </div>
          <div className="mt-2 text-2xl font-bold text-plum">{stats.superAdmins}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Full unrestricted access</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Content Admins</span>
            <Shield className="size-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{stats.contentAdmins}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Catalogue & styles curation</p>
        </div>

        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Custom Restricted</span>
            <Sliders className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.customAdmins}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Granular permissions set</p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="size-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[280px] max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or role..."
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm text-foreground focus:border-plum focus:outline-hidden"
          />
        </div>

        {canManageAdmins && (
          <Button onClick={openAddModal} className="gap-2 bg-plum hover:bg-plum/90 text-white shadow-xs">
            <UserPlus className="size-4" />
            Add Administrator
          </Button>
        )}
      </div>

      {/* Admins Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/80 bg-surface-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Administrator</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Granted Capabilities / Restrictions</th>
              <th className="px-4 py-3">Last Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredAdmins.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No administrators found matching your search.
                </td>
              </tr>
            ) : (
              filteredAdmins.map((admin) => {
                const isCurrent = admin.userId === currentAdmin.id;
                const isWorking = isPending && pendingId === admin.id;

                return (
                  <tr key={admin.id} className="hover:bg-surface-muted/40 transition">
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{admin.name}</span>
                          {isCurrent && (
                            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">{admin.email}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      {admin.role === 'super_admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-plum/10 px-2.5 py-0.5 text-xs font-semibold text-plum">
                          <ShieldAlert className="size-3" /> Super Admin
                        </span>
                      ) : admin.role === 'content_admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          <Shield className="size-3" /> Content Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Sliders className="size-3" /> Custom Restricted
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {admin.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <UserX className="size-3" /> Disabled
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {admin.role === 'super_admin' ? (
                        <span className="text-xs font-medium text-plum">Unrestricted (All 13 privileges granted)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {admin.permissions.slice(0, 3).map((perm) => (
                            <span
                              key={perm}
                              className="inline-block rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                            >
                              {perm}
                            </span>
                          ))}
                          {admin.permissions.length > 3 && (
                            <span className="inline-block rounded-md bg-plum/10 px-1.5 py-0.5 text-[10px] font-medium text-plum">
                              +{admin.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {admin.lastLoginAt
                        ? new Date(admin.lastLoginAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Never'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canManageAdmins && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(admin)}
                            className="h-8 text-xs gap-1"
                          >
                            <Sliders className="size-3 text-plum" />
                            Restrictions
                          </Button>

                          {!isCurrent && (
                            <Button
                              size="sm"
                              variant={admin.status === 'active' ? 'ghost' : 'outline'}
                              disabled={isWorking}
                              onClick={() => handleToggleAdminStatus(admin)}
                              className={`h-8 text-xs ${
                                admin.status === 'active'
                                  ? 'text-destructive hover:bg-destructive/10'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {isWorking ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : admin.status === 'active' ? (
                                <>
                                  <UserX className="size-3.5 mr-1" /> Disable
                                </>
                              ) : (
                                <>
                                  <UserCheck className="size-3.5 mr-1" /> Enable
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ADD ADMINISTRATOR MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-plum/10 text-plum">
                <UserPlus className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">Add Administrator</h3>
                <p className="text-xs text-muted-foreground">
                  Promote an existing account or provision a new administrator with specific role restrictions.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAdmin} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-plum focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    If this user already has an account, they will be promoted.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-muted-foreground">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="StyleMe Admin"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-plum focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground">
                  Initial Password (If creating new account)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for secure auto-generated password"
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-plum focus:outline-hidden"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Role Preset & Security Tier
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('content_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'content_admin'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Shield className="size-4 text-indigo-500" />
                      Content Admin
                    </div>
                    <span className="mt-1 text-xs">Catalogue, style rules, products curation.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('custom_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'custom_admin'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Sliders className="size-4 text-amber-500" />
                      Custom Restrictions
                    </div>
                    <span className="mt-1 text-xs">Configure granular access item-by-item.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('super_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'super_admin'
                        ? 'border-plum bg-plum/10 text-plum ring-1 ring-plum'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <ShieldAlert className="size-4 text-plum" />
                      Super Admin
                    </div>
                    <span className="mt-1 text-xs">Full access including admin management.</span>
                  </button>
                </div>
              </div>

              {/* Granular Permissions & Restrictions Matrix */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Fine-Grained Capability Restrictions</h4>
                    <p className="text-xs text-muted-foreground">
                      {role === 'super_admin'
                        ? 'Super Admins inherently possess all platform permissions.'
                        : 'Select or restrict specific administrative capabilities.'}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {selectedPermissions.length} / {ADMIN_PERMISSION_DEFINITIONS.length} Granted
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((cat) => {
                    const perms = ADMIN_PERMISSION_DEFINITIONS.filter((p) => p.category === cat);
                    return (
                      <div key={cat} className="rounded-xl border border-border bg-surface-muted/30 p-3">
                        <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                          <span>{cat}</span>
                        </div>
                        <div className="space-y-2">
                          {perms.map((p) => {
                            const isChecked = selectedPermissions.includes(p.id) || role === 'super_admin';
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs transition cursor-pointer ${
                                  isChecked
                                    ? 'border-plum/30 bg-plum/5 text-foreground'
                                    : 'border-border/60 bg-surface text-muted-foreground hover:bg-surface-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={role === 'super_admin'}
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.id)}
                                  className="mt-0.5 size-4 rounded-sm border-border text-plum focus:ring-plum"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-foreground">{p.label}</div>
                                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="bg-plum hover:bg-plum/90 text-white">
                  {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save & Grant Privileges
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT RESTRICTIONS MODAL */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <button
              onClick={() => setEditingAdmin(null)}
              className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>

            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-plum/10 text-plum">
                <Sliders className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-foreground">
                  Configure Restrictions: {editingAdmin.name}
                </h3>
                <p className="text-xs text-muted-foreground font-mono">{editingAdmin.email}</p>
              </div>
            </div>

            <form onSubmit={handleUpdateAdmin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-muted-foreground mb-2">Role Preset</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleRoleChange('content_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'content_admin'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Shield className="size-4 text-indigo-500" />
                      Content Admin
                    </div>
                    <span className="mt-1 text-xs">Catalogue, style rules, products curation.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('custom_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'custom_admin'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Sliders className="size-4 text-amber-500" />
                      Custom Restrictions
                    </div>
                    <span className="mt-1 text-xs">Configure granular access item-by-item.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('super_admin')}
                    className={`flex flex-col text-left rounded-xl border p-3 transition ${
                      role === 'super_admin'
                        ? 'border-plum bg-plum/10 text-plum ring-1 ring-plum'
                        : 'border-border bg-surface hover:bg-surface-muted text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <ShieldAlert className="size-4 text-plum" />
                      Super Admin
                    </div>
                    <span className="mt-1 text-xs">Full access across every area.</span>
                  </button>
                </div>
              </div>

              {/* Granular Permissions & Restrictions Matrix */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Granted Capabilities</h4>
                    <p className="text-xs text-muted-foreground">
                      Uncheck to place restrictions on this administrator.
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                    {selectedPermissions.length} / {ADMIN_PERMISSION_DEFINITIONS.length} Allowed
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categories.map((cat) => {
                    const perms = ADMIN_PERMISSION_DEFINITIONS.filter((p) => p.category === cat);
                    return (
                      <div key={cat} className="rounded-xl border border-border bg-surface-muted/30 p-3">
                        <div className="text-xs font-bold text-foreground mb-2 flex items-center justify-between">
                          <span>{cat}</span>
                        </div>
                        <div className="space-y-2">
                          {perms.map((p) => {
                            const isChecked = selectedPermissions.includes(p.id) || role === 'super_admin';
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs transition cursor-pointer ${
                                  isChecked
                                    ? 'border-plum/30 bg-plum/5 text-foreground'
                                    : 'border-border/60 bg-surface text-muted-foreground hover:bg-surface-muted'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={role === 'super_admin'}
                                  checked={isChecked}
                                  onChange={() => togglePermission(p.id)}
                                  className="mt-0.5 size-4 rounded-sm border-border text-plum focus:ring-plum"
                                />
                                <div className="flex-1">
                                  <div className="font-semibold text-foreground">{p.label}</div>
                                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                                    {p.description}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAdmin(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="bg-plum hover:bg-plum/90 text-white">
                  {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Update Restrictions
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
