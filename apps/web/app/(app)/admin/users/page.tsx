import { getAdminUsersAction } from '@/app/actions/admin';
import { UserManagementTable } from '@/components/admin/UserManagementTable';

export default async function AdminUsersPage() {
  const { data, error } = await getAdminUsersAction();

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to load user accounts</p>
        <p className="mt-1 text-xs">{error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">User Management</h2>
        <p className="text-xs text-muted-foreground">
          Review account status and manage access. Private measurements, photos, and passwords remain strictly
          inaccessible.
        </p>
      </header>

      <UserManagementTable initialUsers={data.users} />
    </div>
  );
}
