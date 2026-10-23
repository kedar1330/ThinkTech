import type { Metadata } from 'next';
import Link from 'next/link';
import type { MyColoursResponse } from '@styleme/contracts';
import { WhyMyColours } from '@/components/colours/WhyMyColours';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'My Colour Palette' };

const SECTIONS = [
  {
    href: '/palette/colours',
    title: 'My colours',
    body: '100+ colours chosen for your own skin tone and undertone. Select the ones you like or want to avoid.',
    cta: 'See my colours →',
  },
  {
    href: '/palette/colours?view=coordinating',
    title: 'Coordinating colours',
    body: 'Pick any of your colours to see the ones from your palette that go well with it.',
    cta: 'Find matches →',
  },
  {
    href: '/palette/colours?view=combinations',
    title: 'Curated combinations',
    body: 'Ready-made two- and three-colour outfits built only from your colours, each with a reason it works.',
    cta: 'See combinations →',
  },
] as const;

/**
 * My Colour Palette (#105): only the user's own colours (D-133). The generic curated palette cards are gone;
 * everything here comes from the skin tone and undertone in My Profile and the colours the user likes or avoids.
 */
export default async function PalettePage() {
  const { accessToken } = await requireOnboarded();
  const { category, missing, saved } = await apiRequest<MyColoursResponse>('/v1/colours/mine', {
    token: accessToken,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">My Colour Palette</p>
        <h1 className="font-display text-4xl text-primary">Your colours</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Colours chosen for your own skin tone and undertone, the colours that go with each of them, and ready-made
          combinations to wear.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-3">
        {SECTIONS.map((s, i) => (
          <li key={s.href} className="min-w-0">
            <Link
              href={s.href}
              className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-xs transition-shadow hover:shadow-md"
            >
              <span className="block font-display text-2xl text-primary">{s.title}</span>
              {i === 0 && (
                <span aria-hidden className="flex gap-1.5">
                  {(category?.preview && category.preview.length > 0
                    ? category.preview
                    : [
                        { name: 'Classic Navy', hex: '#1E3A8A' },
                        { name: 'Warm Rust', hex: '#A8432A' },
                        { name: 'Soft Cream', hex: '#F2E8CF' },
                      ]
                  ).map((p) => (
                    <span
                      key={p.hex}
                      className="size-7 rounded-full border border-black/10"
                      style={{ backgroundColor: p.hex }}
                    />
                  ))}
                </span>
              )}
              <span className="block flex-1 text-sm text-muted-foreground">{s.body}</span>
              <span className="text-sm font-medium text-plum">{s.cta}</span>
            </Link>
          </li>
        ))}
      </ul>

      <WhyMyColours categoryLabel={category?.label ?? null} missing={missing} saved={saved} />
    </div>
  );
}
