import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, BookOpen, FileText, LayoutDashboard, ShieldAlert, Users } from 'lucide-react';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = {
  title: 'Admin Panel · StyleMe',
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireOnboarded();

  if (user.role !== 'admin') {
    redirect('/home');
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-plum/20 bg-surface/80 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-plum to-primary text-white shadow-sm">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-foreground">StyleMe Admin</h1>
                <span className="rounded-full bg-plum/10 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-plum">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Platform management, catalogue curation and moderation (privacy protected)
              </p>
            </div>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to App
          </Link>
        </div>

        <nav aria-label="Admin navigation" className="mt-6 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <LayoutDashboard className="size-4 text-plum" />
            Dashboard
          </Link>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <Users className="size-4 text-plum" />
            Users
          </Link>
          <Link
            href="/admin/catalogue"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <BookOpen className="size-4 text-plum" />
            Catalogue
          </Link>
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <FileText className="size-4 text-plum" />
            Audit Logs
          </Link>
        </nav>
      </header>

      <div>{children}</div>
    </div>
  );
}
