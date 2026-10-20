import type { Metadata } from 'next';
import type { CatalogueCategoryItem, ClothingStylesResponse, ProfileResponse } from '@styleme/contracts';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { CategoryExplorer } from '@/components/categories/CategoryExplorer';

export const metadata: Metadata = {
  title: 'Outfit Categories',
  description: 'Browse styles by category, body shape, and styling goals with personalized suitability advice.',
};

export default async function OutfitCategoriesPage() {
  const { accessToken } = await requireOnboarded();

  // Fetch published categories and styles in parallel
  const [categories, stylesResult, profile] = await Promise.all([
    apiRequest<CatalogueCategoryItem[]>('/v1/catalogue/categories', { token: accessToken }).catch(
      () => [] as CatalogueCategoryItem[],
    ),
    apiRequest<ClothingStylesResponse>('/v1/catalogue/styles?limit=100', { token: accessToken }).catch(
      () => ({ items: [], total: 0, page: 1, limit: 100, pages: 1 }) as ClothingStylesResponse,
    ),
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }).catch(() => null),
  ]);

  const userDepartment = profile?.department && profile.department !== 'any' ? profile.department : 'all';

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

      <CategoryExplorer
        initialCategories={categories}
        initialStyles={stylesResult.items}
        userDepartment={userDepartment}
      />
    </div>
  );
}
