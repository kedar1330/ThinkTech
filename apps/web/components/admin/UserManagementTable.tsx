'use client';

import { useState, useTransition } from 'react';
import { CheckCircle, Loader2, Search, UserX, UserCheck, Shield } from 'lucide-react';
import type { AdminUserItem } from '@styleme/contracts';
import { setAdminUserStatusAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

export function UserManagementTable({ initialUsers }: { initialUsers: AdminUserItem[] }) {
  const [users, setUsers] = useState<AdminUserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase()),
  );

  function handleToggleStatus(user: AdminUserItem) {
    const nextStatus = !user.isActive;
    const confirmMsg = nextStatus
      ? `Reactivate account for ${user.name} (${user.email})?`
      : `Suspend account for ${user.name} (${user.email})? This immediately invalidates all active sessions.`;

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setPendingId(user.id);

    startTransition(async () => {
      const result = await setAdminUserStatusAction(
        user.id,
        nextStatus,
        nextStatus ? 'Reactivated by admin' : 'Suspended by admin',
      );
      setPendingId(null);
      if (result.success) {
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: nextStatus } : u)));
      } else {
        setError(result.error ?? 'Failed to update user status');
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[280px] max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or ID..."
            className="w-full rounded-lg border border-border bg-surface pl-9 pr-4 py-2 text-sm text-foreground focus:border-plum focus:outline-hidden"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredUsers.length}</span> user accounts
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/80 bg-surface-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isWorking = isPending && pendingId === user.id;
                return (
                  <tr key={user.id} className="hover:bg-surface-muted/40 transition">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-foreground">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium text-foreground">
                        {user.role === 'admin' ? (
                          <>
                            <Shield className="size-3 text-plum" /> Admin
                          </>
                        ) : (
                          'User'
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                          <UserX className="size-3" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={user.isActive ? 'outline' : 'default'}
                        disabled={isWorking}
                        onClick={() => handleToggleStatus(user)}
                        className="text-xs"
                      >
                        {isWorking ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : user.isActive ? (
                          <>
                            <UserX className="size-3.5 mr-1 text-red-600" /> Suspend
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3.5 mr-1 text-emerald-600" /> Reactivate
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
