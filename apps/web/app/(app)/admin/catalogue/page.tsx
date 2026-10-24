import { getAdminCatalogueAction } from '@/app/actions/admin';
import { CatalogueManagementTable } from '@/components/admin/CatalogueManagementTable';

export default async function AdminCataloguePage() {
  const { data, error } = await getAdminCatalogueAction();

  if (error || !data) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">Failed to load catalogue records</p>
        <p className="mt-1 text-xs">{error ?? 'Please check API connection'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold text-foreground">Catalogue Management</h2>
        <p className="text-xs text-muted-foreground">
          Curate and maintain styles, categories, outfit templates, and palettes. Records can be archived rather than
          permanently deleted.
        </p>
      </header>

      <CatalogueManagementTable initialItems={data.items} />
    </div>
  );
}
