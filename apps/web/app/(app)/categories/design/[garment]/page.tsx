import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CLOTHING_PREFERENCES,
  HEIGHT_BANDS,
  OUTFIT_CATEGORIES,
  outfitCategorySchema,
  type DesignFeaturesResponse,
  type DesignPreferencesResponse,
} from '@styleme/contracts';
import { DesignStudio } from '@/components/design/DesignStudio';
import { ApiError, apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Necklines, sleeves and more' };

/**
 * Design features for one garment (D-132): only the necklines, sleeves and details that suit the user, from
 * their Clothing Preference, body type, height band and goals, with a visual customizer.
 */
export default async function GarmentDesignPage({
  params,
  searchParams,
}: {
  params: Promise<{ garment: string }>;
  searchParams?: Promise<{ outfit?: string; view?: string; department?: string }>;
}) {
  const { garment } = await params;
  const query = searchParams ? await searchParams : {};
  const { accessToken } = await requireOnboarded();
  const view = query.view === 'all' ? 'all' : 'suits';
  const department = query.department === 'women' || query.department === 'men' ? query.department : undefined;
  const qs = new URLSearchParams({ garmentType: garment, view, ...(department ? { department } : {}) });

  let data: DesignFeaturesResponse;
  try {
    data = await apiRequest<DesignFeaturesResponse>(`/v1/design/features?${qs.toString()}`, { token: accessToken });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const prefs = await apiRequest<DesignPreferencesResponse>('/v1/design/preferences', { token: accessToken }).catch(
    () => null,
  );

  const parsedOutfit = outfitCategorySchema.safeParse(query.outfit);
  const outfit =
    parsedOutfit.success && data.garmentType.outfitCategories.includes(parsedOutfit.data)
      ? parsedOutfit.data
      : data.garmentType.outfitCategories[0]!;
  const outfitLabel = OUTFIT_CATEGORIES.find((c) => c.id === outfit)?.label;
  const departmentLabel = CLOTHING_PREFERENCES.find((c) => c.id === data.department)?.label;
  const personalised = data.categories.some((c) => c.personalised);
  const band = HEIGHT_BANDS.find((b) => b.id === data.basis.heightBand)?.label;
  const viewHref = (v: 'suits' | 'all') =>
    `/categories/design/${garment}?${new URLSearchParams({ outfit, view: v, ...(department ? { department } : {}) }).toString()}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        <Link href="/categories" className="hover:underline">
          Outfit Categories
        </Link>{' '}
        /{' '}
        <Link
          href={`/categories?outfit=${outfit}${department ? `&department=${department}` : ''}`}
          className="hover:underline"
        >
          {departmentLabel} · {outfitLabel}
        </Link>{' '}
        / <span className="text-foreground">{data.garmentType.name}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-plum">Sleeves & necklines selection</p>
          <h1 className="font-display text-4xl text-primary">{data.garmentType.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Choose the neckline, sleeve and details for your {data.garmentType.name.toLowerCase()}.{' '}
            {personalised
              ? `Shown for you from your ${[data.basis.bodyType && 'body type', band && `height (${band.toLowerCase()})`, data.basis.stylingGoals > 0 && 'styling goals'].filter(Boolean).join(', ')}.`
              : 'Every option is shown.'}
          </p>
        </div>
        <div role="group" aria-label="What to show" className="flex rounded-full border border-border p-0.5 text-sm">
          {(['suits', 'all'] as const).map((v) => (
            <Link
              key={v}
              href={viewHref(v)}
              aria-current={view === v ? 'true' : undefined}
              className={cn(
                'rounded-full px-4 py-1.5',
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {v === 'suits' ? 'Suits me' : 'Show all'}
            </Link>
          ))}
        </div>
      </header>

      {!personalised && (
        <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-foreground">
          {!data.basis.bodyType && !data.basis.heightBand ? (
            <>
              Add your body type and height in{' '}
              <Link href="/profile" className="text-plum underline underline-offset-2">
                My Profile
              </Link>{' '}
              so we can show only the styles that suit you.
            </>
          ) : (
            'Personalised suggestions for this garment are still being reviewed by our stylists, so every option is shown for now.'
          )}
        </p>
      )}

      <DesignStudio
        key={`${data.department}-${garment}-${view}`}
        data={data}
        outfitCategory={outfit}
        stylingGoals={prefs?.stylingGoals ?? []}
        department={department}
      />
    </div>
  );
}
