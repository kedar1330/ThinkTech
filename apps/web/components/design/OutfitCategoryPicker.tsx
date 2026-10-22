import Link from 'next/link';
import { CLOTHING_PREFERENCES, type DesignTaxonomyResponse } from '@styleme/contracts';
import { cn } from '@/lib/utils';

// Outfit Categories, step by step (D-132): the Clothing Preference from My Profile decides Women's or Men's
// Wear, the user picks Indian, Western or Indo-Western, then a garment, whose design features open next.

interface OutfitCategoryPickerProps {
  taxonomy: DesignTaxonomyResponse;
  outfit: string;
}

export function OutfitCategoryPicker({ taxonomy, outfit }: OutfitCategoryPickerProps) {
  const department = taxonomy.department;
  const label = CLOTHING_PREFERENCES.find((c) => c.id === department)?.label;
  const current = taxonomy.outfitCategories.find((c) => c.id === outfit) ?? null;
  const qs = (extra: Record<string, string>) => {
    const params = new URLSearchParams({
      ...(department && taxonomy.canSwitchDepartment ? { department } : {}),
      ...extra,
    });
    return `?${params.toString()}`;
  };

  return (
    <section aria-labelledby="design-steps" className="space-y-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="design-steps" className="font-display text-2xl text-primary">
          Design by category
        </h2>
        {taxonomy.canSwitchDepartment ? (
          <div
            role="group"
            aria-label="Clothing Preference"
            className="flex rounded-full border border-border p-0.5 text-sm"
          >
            {CLOTHING_PREFERENCES.map((c) => (
              <Link
                key={c.id}
                href={`/categories?department=${c.id}${outfit ? `&outfit=${outfit}` : ''}`}
                aria-current={department === c.id ? 'true' : undefined}
                className={cn(
                  'rounded-full px-3 py-1',
                  department === c.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{label}</span> from{' '}
            <Link href="/profile#basics" className="text-plum underline underline-offset-2">
              My Profile
            </Link>
          </p>
        )}
      </div>

      {!department ? (
        <p className="text-sm text-muted-foreground">
          Choose Women’s Wear or Men’s Wear to see garments and design features.
        </p>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Which category are you dressing for?</p>
            <ul className="flex flex-wrap gap-2">
              {taxonomy.outfitCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={qs({ outfit: c.id })}
                    aria-current={outfit === c.id ? 'true' : undefined}
                    className={cn(
                      'inline-block rounded-full border px-4 py-1.5 text-sm transition',
                      outfit === c.id
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-border hover:border-accent/60',
                    )}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {current && (
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Which garment?</p>
              {current.garmentTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No garments in this category yet.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {current.garmentTypes.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={`/categories/design/${g.id}${qs({ outfit: current.id })}`}
                        className="block rounded-xl border border-border bg-[#fbf6ec] px-4 py-3 text-center text-sm font-medium text-foreground transition hover:border-accent hover:ring-1 hover:ring-accent"
                      >
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
