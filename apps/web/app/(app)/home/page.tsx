import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookmarkCheck,
  Camera,
  Compass,
  MapPin,
  MessageSquare,
  Palette,
  Pencil,
  Scissors,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  CLOTHING_PREFERENCES,
  DEFAULT_MANUAL_STEPS,
  MONK_TONES,
  bodyTypeLabel,
  cityLabel,
  departmentScope,
  profileCompleteness,
  type AppearanceResponse,
  type ManualStepsResponse,
  type ProfileResponse,
} from '@styleme/contracts';
import { ProfileCompletenessCard } from '@/components/app/ProfileCompleteness';
import { HowItWorksManual } from '@/components/home/HowItWorksManual';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Home' };

const QUICK_STUDIO_FEATURES = [
  {
    title: 'Colour Palette',
    tag: 'Harmonic Tones',
    href: '/palette',
    Icon: Palette,
    desc: 'Explore your skin tone harmonies, contrast balance, and bespoke color swatches.',
    badge: 'Live',
    accentColor: 'text-plum',
    bgColor: 'bg-plum/10',
  },
  {
    title: 'Curated Looks',
    tag: 'Occasion Outfits',
    href: '/discover/looks',
    Icon: Sparkles,
    desc: 'Discover head-to-toe outfits for festive, formal, or casual days with reasons.',
    badge: 'AI Engine',
    accentColor: 'text-accent',
    bgColor: 'bg-accent/15',
  },
  {
    title: 'Outfit Categories',
    tag: 'Style Library',
    href: '/categories',
    Icon: Shirt,
    desc: 'Browse curated collections across Indian, Indo-Western, and contemporary cuts.',
    badge: 'Curated',
    accentColor: 'text-plum',
    bgColor: 'bg-plum/10',
  },
  {
    title: 'Virtual Try-On',
    tag: '3D Fitting',
    href: '/try-on',
    Icon: Camera,
    desc: 'Preview outfits on your personalized avatar with 360° rotational view.',
    badge: '3D Studio',
    accentColor: 'text-accent',
    bgColor: 'bg-accent/15',
  },
  {
    title: 'Design Studio',
    tag: 'Tailor Specs',
    href: '/design-studio',
    Icon: Scissors,
    desc: 'Design bespoke silhouettes, select necklines, and export printable tailor sheets.',
    badge: 'Bespoke',
    accentColor: 'text-plum',
    bgColor: 'bg-plum/10',
  },
  {
    title: 'Style Assistant',
    tag: 'Fashion AI',
    href: '/assistant',
    Icon: MessageSquare,
    desc: 'Ask real-time questions about fabric matching, accessorizing, and styling etiquette.',
    badge: 'Instant AI',
    accentColor: 'text-accent',
    bgColor: 'bg-accent/15',
  },
  {
    title: 'Shop My Look',
    tag: 'Budget Tracker',
    href: '/shop',
    Icon: ShoppingBag,
    desc: 'Pair garments across online retailers and stay strictly within your budget per look.',
    badge: 'Smart Shop',
    accentColor: 'text-plum',
    bgColor: 'bg-plum/10',
  },
  {
    title: 'Saved Wardrobe',
    tag: 'Digital Closet',
    href: '/saved',
    Icon: BookmarkCheck,
    desc: 'Review your saved ensembles, shortlist pieces, and export custom collections.',
    badge: 'Wardrobe',
    accentColor: 'text-accent',
    bgColor: 'bg-accent/15',
  },
];

/** Personalized Home: what StyleMe knows about the user's style today, and what is coming next. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; skipped?: string }>;
}) {
  const { user, accessToken } = await requireOnboarded();
  const { welcome, skipped } = await searchParams;
  const [profile, appearance, manualData] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }).catch(() => null),
    apiRequest<ManualStepsResponse>('/v1/manual', { token: accessToken }).catch(() => null),
  ]);
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const department = CLOTHING_PREFERENCES.find((d) => d.id === profile.department)?.label;
  // Without a department, features give general results across all departments (FR-ONB-05).
  const scope = departmentScope(profile);
  const completeness = profileCompleteness(profile, user, appearance);
  const monkTone = appearance?.skinTone ? Number(appearance.skinTone.value.monkRange.split('-')[0]) : null;
  const undertone = appearance?.undertone?.value;
  const manualSteps = manualData?.steps?.length ? manualData.steps : DEFAULT_MANUAL_STEPS;

  return (
    <div className="space-y-12 pb-10">
      {welcome && <Alert tone="success">Welcome to StyleMe, {firstName}! Your style profile is set up.</Alert>}
      {skipped && (
        <Alert tone="info">
          Welcome to StyleMe, {firstName}! You skipped the style profile for now. Everything still works — add your
          details whenever you like for more personal suggestions.
        </Alert>
      )}

      {/* Hero Welcome Banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-surface via-surface-muted/40 to-accent-soft/30 p-6 sm:p-9 shadow-xs">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-accent/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -bottom-20 size-64 rounded-full bg-plum/10 blur-3xl"
        />

        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-plum/30 bg-plum/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-plum">
                <Sparkles className="size-3.5 text-plum animate-pulse-subtle" />
                Personalized Home
              </span>
              <span className="rounded-full bg-surface/80 px-2.5 py-0.5 text-xs text-muted-foreground border border-border/60">
                Festive &amp; Everyday Edition
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl text-primary tracking-tight">
              Hello, <span className="italic text-plum">{firstName}</span>
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed">
              Your personalized fashion sanctuary. Explore styles tailored to your unique skin tone, body shape, and
              budget.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:self-start md:self-center">
            <Button asChild variant="default" size="lg" className="shadow-xs">
              <Link href="/discover/looks">
                Discover Outfits <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/profile">Edit Profile</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Profile Completeness Alert (if incomplete) */}
      <ProfileCompletenessCard completeness={completeness} />

      {/* Main Dual Cards: Generous, Tall Proportions */}
      <section className="grid gap-6 lg:grid-cols-12 items-stretch">
        {/* Style Profile Dashboard Card (lg:col-span-7) */}
        <Card className="min-w-0 lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-3xl border border-border/80 shadow-sm transition-all duration-300 card-lift min-h-[380px]">
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Profile Active
                  </span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl text-primary">Your style profile</h2>
              </div>
              <Button asChild variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                <Link href="/profile">
                  <Pencil className="size-3.5" /> Edit
                </Link>
              </Button>
            </div>

            {/* Rich Grid of Profile Attributes */}
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-4 transition-colors hover:border-plum/40">
                <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Shirt className="size-3.5 text-plum" />
                  Clothing preference
                </dt>
                <dd className="mt-1.5 font-medium text-base text-foreground">
                  {department ?? 'Not set'}
                  {!scope.filterApplied && (
                    <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                      Not chosen yet — showing everything
                    </span>
                  )}
                </dd>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-4 transition-colors hover:border-plum/40">
                <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <MapPin className="size-3.5 text-plum" />
                  City
                </dt>
                <dd className="mt-1.5 font-medium text-base text-foreground">{cityLabel(user.city) ?? 'Not set'}</dd>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-4 transition-colors hover:border-plum/40">
                <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Wallet className="size-3.5 text-accent" />
                  Budget per look
                </dt>
                <dd className="mt-1.5 font-medium text-base text-foreground">
                  {profile.budgetPreference ? `₹${profile.budgetPreference.toLocaleString('en-IN')}` : 'Not set'}
                </dd>
              </div>

              <div className="rounded-2xl border border-border/70 bg-surface-muted/30 p-4 transition-colors hover:border-plum/40">
                <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Palette className="size-3.5 text-plum" />
                  Skin tone &amp; undertone
                </dt>
                <dd className="mt-1.5 flex items-center gap-2 font-medium text-base text-foreground">
                  {monkTone ? (
                    <>
                      <span
                        aria-hidden
                        className="size-4.5 rounded-full border border-border shadow-xs"
                        style={{ backgroundColor: MONK_TONES[monkTone - 1]?.hex }}
                      />
                      Tone {monkTone}
                      {undertone && undertone !== 'not_sure' ? `, ${undertone}` : ''}
                    </>
                  ) : (
                    <Link href="/profile#skin-tone" className="text-plum underline text-sm">
                      Add from a photo or choose
                    </Link>
                  )}
                </dd>
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-border/70 bg-surface-muted/30 p-4 transition-colors hover:border-plum/40">
                <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Compass className="size-3.5 text-plum" />
                  Body type &amp; Silhouette
                </dt>
                <dd className="mt-1.5 font-medium text-base text-foreground">
                  {appearance?.bodyType ? (
                    bodyTypeLabel(appearance.bodyType.value)
                  ) : (
                    <Link href="/profile#body-type" className="text-plum underline text-sm">
                      Add measurements or a photo
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground mt-4">
            <span>Tailoring recommendations according to your choices</span>
            <Link href="/profile" className="font-semibold text-plum hover:underline">
              View all &rarr;
            </Link>
          </div>
        </Card>

        {/* Discover My Style Spotlight Hero Card (lg:col-span-5) */}
        <Card className="min-w-0 lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-3xl luxury-mesh-dark text-primary-foreground shadow-lg transition-all duration-300 card-lift min-h-[380px] relative overflow-hidden">
          {/* Subtle sparkling decorative element */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 top-4 size-32 rounded-full bg-accent/20 blur-2xl"
          />

          <div className="relative space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent backdrop-blur-md">
                <Sparkles className="size-3 text-accent animate-pulse-subtle" />
                Featured Experience
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-3xl sm:text-4xl text-white tracking-tight">Discover My Style</h2>
              <p className="text-sm text-primary-foreground/80 leading-relaxed">
                Get full outfit recommendations crafted for any occasion, harmonized with your exact skin tone,
                undertone, and body silhouette.
              </p>
            </div>

            {/* Feature Highlights Chips */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-primary-foreground/90">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10 text-accent font-bold">
                  ✓
                </span>
                <span>Tone-matched color combinations</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-primary-foreground/90">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10 text-accent font-bold">
                  ✓
                </span>
                <span>Budget-conscious item pairings</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-primary-foreground/90">
                <span className="flex size-5 items-center justify-center rounded-full bg-white/10 text-accent font-bold">
                  ✓
                </span>
                <span>Explanation of why every look suits you</span>
              </div>
            </div>
          </div>

          <div className="relative pt-6">
            <Button asChild variant="accent" size="lg" className="w-full shadow-md font-semibold text-base py-6">
              <Link href="/discover/looks">
                Open Curated Looks <ArrowRight aria-hidden className="size-4 ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      </section>

      {/* Platform Studio Hub: 8 Core Capabilities (Taller, Richer Cards) */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-plum/10 text-plum">
                <Compass className="size-3.5" />
              </span>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-plum">StyleMe Capabilities</p>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-primary tracking-tight mt-1">Your Styling Studio</h2>
          </div>
          <p className="text-xs text-muted-foreground sm:max-w-xs text-left sm:text-right">
            Instant shortcuts to each interactive styling tool in your wardrobe ecosystem.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_STUDIO_FEATURES.map((feat) => {
            const FeatIcon = feat.Icon;
            return (
              <Card
                key={feat.title}
                className="group flex flex-col justify-between p-6 rounded-2xl border border-border/80 bg-surface transition-all duration-300 card-lift min-h-[220px] hover:border-plum/50"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex size-11 items-center justify-center rounded-xl ${feat.bgColor} ${feat.accentColor} transition-transform duration-300 group-hover:scale-110 shadow-xs`}
                    >
                      <FeatIcon className="size-5" />
                    </div>
                    <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {feat.badge}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-plum">{feat.tag}</p>
                    <h3 className="font-display text-lg text-primary font-semibold group-hover:text-plum transition-colors">
                      {feat.title}
                    </h3>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">{feat.desc}</p>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <Link
                    href={feat.href}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary group-hover:text-plum transition-colors"
                  >
                    Open Studio
                    <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Interactive Website Manual Component */}
      <HowItWorksManual steps={manualSteps} />
    </div>
  );
}
