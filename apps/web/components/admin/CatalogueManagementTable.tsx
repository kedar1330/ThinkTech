'use client';

import { useState, useTransition } from 'react';
import { Archive, CheckCircle, FolderTree, Loader2, Palette, Shirt, Tag } from 'lucide-react';
import type { AdminCatalogueItem, AdminCatalogueType } from '@styleme/contracts';
import { setAdminCatalogueStatusAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';

export function CatalogueManagementTable({ initialItems }: { initialItems: AdminCatalogueItem[] }) {
  const [items, setItems] = useState<AdminCatalogueItem[]>(initialItems);
  const [filterType, setFilterType] = useState<string>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredItems = items.filter((item) => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    return true;
  });

  function handleToggleStatus(item: AdminCatalogueItem) {
    const nextStatus = item.status === 'published' ? 'archived' : 'published';
    if (!window.confirm(`Set status of "${item.name}" to ${nextStatus}?`)) return;

    setError(null);
    setPendingId(item.id);

    startTransition(async () => {
      const result = await setAdminCatalogueStatusAction(item.type, item.id, nextStatus);
      setPendingId(null);
      if (result.success) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)));
      } else {
        setError(result.error ?? 'Failed to update item status');
      }
    });
  }

  const typeIcons: Record<AdminCatalogueType, typeof Shirt> = {
    category: FolderTree,
    style: Shirt,
    template: Tag,
    palette: Palette,
  };

  return (
    <div className="space-y-4">
      {/* Type Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'category', 'style', 'template', 'palette'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filterType === t
                  ? 'bg-plum text-white shadow-xs'
                  : 'border border-border bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredItems.length}</span> items
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Items Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border/80 bg-surface-muted/60 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Publication</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No catalogue records found.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => {
                const Icon = typeIcons[item.type] ?? Tag;
                const isWorking = isPending && pendingId === item.id;
                return (
                  <tr key={`${item.type}-${item.id}`} className="hover:bg-surface-muted/40 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{item.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{item.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2 py-0.5 text-xs font-medium capitalize text-foreground">
                        <Icon className="size-3 text-plum" />
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'published' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle className="size-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                          <Archive className="size-3" /> Archived
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isWorking}
                        onClick={() => handleToggleStatus(item)}
                        className="text-xs"
                      >
                        {isWorking ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : item.status === 'published' ? (
                          <>
                            <Archive className="size-3.5 mr-1 text-amber-600" /> Archive
                          </>
                        ) : (
                          <>
                            <CheckCircle className="size-3.5 mr-1 text-emerald-600" /> Publish
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
