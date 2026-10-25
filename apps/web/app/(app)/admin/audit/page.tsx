import { Clock, HelpCircle, Lock, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AUDIT_ACTION_PURPOSES } from '@styleme/contracts';
import { getAdminAuditLogsAction } from '@/app/actions/admin';

export default async function AdminAuditPage() {
  const { data, error } = await getAdminAuditLogsAction();

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to load audit logs</p>
        <p className="mt-1 text-xs">{error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  const { logs } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-2xl font-bold text-foreground">Administrative Audit Trail</h2>
          <span className="rounded-full bg-plum/10 px-2.5 py-0.5 text-xs font-semibold text-plum">
            1-Year Immutable Log
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Chronological record of sensitive administrative actions (FR-ADM-09). Retained for 1 year with automatic TTL.
        </p>
      </header>

      {/* "WHAT IS THE AUDIT LOG FOR?" COMPREHENSIVE GUIDE CARD */}
      <div className="rounded-2xl border border-plum/20 bg-gradient-to-br from-surface to-plum/5 p-6 shadow-xs">
        <div className="flex items-center gap-2.5 text-plum font-semibold text-sm">
          <HelpCircle className="size-5" />
          <span>What is the Audit Log for?</span>
        </div>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-3xl">
          The StyleMe Administrative Audit Log is a tamper-evident compliance and security mechanism designed to
          guarantee transparency, prevent unauthorized privilege escalation, and protect user data integrity.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/80 bg-surface/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <ShieldAlert className="size-4 text-plum" />
              <span>1. Admin Accountability</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Every action taken by super admins and moderators—such as changing restrictions, adding admins, or
              suspending users—is permanently recorded with the actor ID.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Lock className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>2. Zero-PII Privacy</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Privacy by Design: Audit entries record field names and sanitised values only. Personal photos, body
              measurements, style profiles, and passwords are strictly excluded.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <Clock className="size-4 text-blue-600 dark:text-blue-400" />
              <span>3. 365-Day Retention</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Complies with data privacy regulations (GDPR/ISO). Records are retained for exactly one year, after which
              MongoDB automated TTL indexes permanently expire them.
            </p>
          </div>

          <div className="rounded-xl border border-border/80 bg-surface/90 p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
              <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" />
              <span>4. Operational Traceability</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
              Provides an audit trail to investigate accidental catalogue unpublishing, track founder approvals on style
              rules, and audit session revocations.
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/80 bg-surface-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">What was it for? (Purpose)</th>
              <th className="px-4 py-3">Target Entity</th>
              <th className="px-4 py-3">Changes (Sanitised)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="size-6 text-emerald-500" />
                    <span>No administrative actions recorded yet.</span>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const purposeInfo = AUDIT_ACTION_PURPOSES[log.action] ?? {
                  title: log.action,
                  purpose: 'Administrative action performed on system resource.',
                  badgeVariant: 'default',
                };

                return (
                  <tr key={log.id} className="hover:bg-surface-muted/40 transition">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>

                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md bg-plum/10 px-2 py-0.5 text-xs font-semibold font-mono text-plum">
                        {log.action}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="max-w-xs">
                        <div className="text-xs font-semibold text-foreground">{purposeInfo.title}</div>
                        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                          {purposeInfo.purpose}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-foreground capitalize">
                        {log.targetType.replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground truncate max-w-[140px]">
                        {log.targetId}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs">
                      {log.changes.length > 0 ? (
                        <div className="space-y-0.5 max-w-xs">
                          {log.changes.map((c, i) => (
                            <div key={i} className="text-muted-foreground">
                              <span className="font-semibold text-foreground">{c.field}</span>
                              {c.from !== undefined && <span>: {String(c.from)} → </span>}
                              {c.to !== undefined && <span className="font-medium text-plum">{String(c.to)}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">No attribute modifications</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        }`}
                      >
                        {log.status}
                      </span>
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
