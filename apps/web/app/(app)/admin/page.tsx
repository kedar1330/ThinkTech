import Link from 'next/link';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FolderTree,
  Lock,
  Palette,
  Shirt,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { getAdminDashboardAction } from '@/app/actions/admin';

export default async function AdminDashboardPage() {
  const { data: dashboard, error } = await getAdminDashboardAction();

  if (error || !dashboard) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to load admin dashboard</p>
        <p className="mt-1 text-xs">{error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  const { stats, attention } = dashboard;

  const metricCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, desc: 'Registered accounts' },
    { label: 'Active Users', value: stats.activeUsers, icon: UserCheck, desc: 'Enabled accounts' },
    { label: 'New This Week', value: stats.newUsersLast7Days, icon: UserPlus, desc: 'Last 7 days' },
    { label: 'Clothing Styles', value: stats.totalStyles, icon: Shirt, desc: 'Curated styles' },
    { label: 'Catalogue Categories', value: stats.totalCategories, icon: FolderTree, desc: 'Taxonomy nodes' },
    { label: 'Colour Palettes', value: stats.totalPalettes, icon: Palette, desc: 'Curated palettes' },
    { label: 'Outfit Templates', value: stats.totalOutfitTemplates, icon: CheckCircle2, desc: 'Template specs' },
    { label: 'Try-On Runs', value: stats.totalTryOnJobs, icon: Camera, desc: 'Total generations' },
  ];

  return (
    <div className="space-y-6">
      {/* Privacy guarantee banner (FR-ADM-06, D-120) */}
      <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-4 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
        <Lock className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="text-xs">
          <p className="font-semibold">Privacy Boundary Enforced</p>
          <p className="mt-0.5 text-muted-foreground">
            In accordance with StyleMe privacy guidelines (FR-ADM-06), administrative accounts cannot view or export
            passwords, raw body measurements, or private user photos. All user actions are logged in the audit trail.
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <section aria-labelledby="metrics-heading" className="space-y-3">
        <h2 id="metrics-heading" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Platform Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-xl border border-border bg-surface p-4 shadow-xs transition hover:border-plum/40 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                  <Icon className="size-4 text-plum" />
                </div>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Attention & Action Queues */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Pending Attention */}
        <section
          aria-labelledby="attention-heading"
          className="rounded-xl border border-border bg-surface p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 id="attention-heading" className="text-sm font-semibold text-foreground">
              Attention Queue
            </h2>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/50 p-2.5">
              <span>Drafts awaiting approval</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">
                {attention.draftsAwaitingApproval}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/50 p-2.5">
              <span>Missing illustrations</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">
                {attention.missingIllustrations}
              </span>
            </li>
            <li className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-muted/50 p-2.5">
              <span>Open product reports</span>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-foreground">
                {attention.openProductReports}
              </span>
            </li>
          </ul>
        </section>

        {/* Quick Operations */}
        <section aria-labelledby="actions-heading" className="rounded-xl border border-border bg-surface p-5 space-y-3">
          <h2 id="actions-heading" className="text-sm font-semibold text-foreground">
            Administrative Shortcuts
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <Link
              href="/admin/users"
              className="flex items-center gap-2 rounded-lg border border-border p-3 font-medium transition hover:border-plum hover:bg-surface-muted"
            >
              <Users className="size-4 text-plum" />
              <span>Manage Users</span>
            </Link>
            <Link
              href="/admin/catalogue"
              className="flex items-center gap-2 rounded-lg border border-border p-3 font-medium transition hover:border-plum hover:bg-surface-muted"
            >
              <Shirt className="size-4 text-plum" />
              <span>Catalogue Items</span>
            </Link>
            <Link
              href="/admin/audit"
              className="flex items-center gap-2 rounded-lg border border-border p-3 font-medium transition hover:border-plum hover:bg-surface-muted"
            >
              <CheckCircle2 className="size-4 text-plum" />
              <span>Review Audit Trail</span>
            </Link>
            <Link
              href="/home"
              className="flex items-center gap-2 rounded-lg border border-border p-3 font-medium transition hover:border-plum hover:bg-surface-muted"
            >
              <Lock className="size-4 text-plum" />
              <span>Customer Experience</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
