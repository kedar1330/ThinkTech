import type { Metadata } from 'next';
import type { DesignTaxonomyResponse } from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { OutfitCategoryPicker } from '@/components/design/OutfitCategoryPicker';

export const metadata: Metadata = {
  title: 'Outfit Categories',
  description: 'Browse styles by category, body shape, and styling goals with personalized suitability advice.',
};

export default async function OutfitCategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ outfit?: string; department?: string }>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const { accessToken } = await requireOnboarded();
  const department = params.department === 'women' || params.department === 'men' ? params.department : null;

  const taxonomy = await apiRequest<DesignTaxonomyResponse>(
    `/v1/design/taxonomy${department ? `?department=${department}` : ''}`,
    { token: accessToken },
  ).catch(() => null);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-plum">Outfit Categories</p>
        <h1 className="font-display text-4xl text-primary">Explore silhouettes & styles</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Discover silhouettes across Indian ethnic, western, and fusion wear. Each piece includes styling rationale
          explaining how necklines, cuts, and drape balance proportions and suit your styling goals.
        </p>
      </header>

      {taxonomy && <OutfitCategoryPicker taxonomy={taxonomy} outfit={params.outfit ?? ''} />}
    </div>
  );
}
