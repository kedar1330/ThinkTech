import { getAdminMeAction, getAdminsAction } from '@/app/actions/admin';
import { AdminManagementView } from '@/components/admin/AdminManagementView';

export default async function AdminAdminsPage() {
  const [meResult, adminsResult] = await Promise.all([getAdminMeAction(), getAdminsAction()]);

  if (meResult.error || !meResult.data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to verify administrator profile</p>
        <p className="mt-1 text-xs">{meResult.error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  if (adminsResult.error || !adminsResult.data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to load administrator accounts</p>
        <p className="mt-1 text-xs">{adminsResult.error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">Admin Accounts & Access Restrictions</h2>
        <p className="text-xs text-muted-foreground">
          Manage system administrators, configure role presets, and set granular restriction policies across catalogue,
          moderation, and platform security.
        </p>
      </header>

      <AdminManagementView initialAdmins={adminsResult.data.admins} currentAdmin={meResult.data} />
    </div>
  );
}
