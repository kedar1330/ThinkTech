import { ShieldCheck } from 'lucide-react';
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
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">Administrative Audit Trail</h2>
        <p className="text-xs text-muted-foreground">
          Chronological record of sensitive administrative actions (FR-ADM-09). Retained for 1 year with automatic TTL.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/80 bg-surface-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Changes (Sanitised)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <ShieldCheck className="size-6 text-emerald-500" />
                    <span>No administrative actions recorded yet.</span>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
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
                    <div className="text-xs font-medium text-foreground capitalize">
                      {log.targetType.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate max-w-[150px]">{log.targetId}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {log.changes.length > 0 ? (
                      <div className="space-y-0.5">
                        {log.changes.map((c, i) => (
                          <div key={i} className="text-muted-foreground">
                            <span className="font-semibold text-foreground">{c.field}</span>
                            {c.from !== undefined && <span>: {String(c.from)} → </span>}
                            {c.to !== undefined && <span className="font-medium text-plum">{String(c.to)}</span>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">None</span>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
