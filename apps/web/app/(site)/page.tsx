import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Camera,
  MessageCircle,
  Palette,
  PencilRuler,
  ShoppingBag,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BRAND_IMAGES, LOOKBOOK_IMAGES } from '@/lib/brand/images';

// Public landing page. It describes only what exists today; everything else is labelled "Coming soon"
// (no fabricated functionality).

const STEPS = [
  {
    n: '01',
    title: 'Create your account',
    body: 'Sign up with your email or Google and verify your address. It takes about a minute.',
  },
  {
    n: '02',
    title: 'Build your style profile',
    body: 'Tell us your department, sizes per category, fit, colours you love or avoid, coverage, fabrics and occasions.',
  },
  {
    n: '03',
    title: 'Add appearance signals (optional)',
    body: 'Self-reported skin-tone range, undertone and proportions — gentle hints, never rules. Skip if you prefer.',
  },
  {
    n: '04',
    title: 'Get your personalized home',
    body: 'Your profile in one place, ready for the styling features as they launch.',
  },
];

const PERSONAL = [
  {
    title: 'Sizes that differ by category',
    body: 'Tops, bottoms, kurtas, lehengas and shoes each keep their own size.',
  },
  { title: 'Colours you love — and avoid', body: 'Avoided colours never appear; liked colours are favoured.' },
  {
    title: 'Your comfort, your coverage',
    body: 'Set the shortest sleeve, neckline and length you are comfortable with.',
  },
  {
    title: 'Fabrics and occasions',
    body: 'From breathable cottons to festive silks, for office, weddings and weekends.',
  },
];

const UPCOMING = [
  {
    Icon: Sparkles,
    title: 'Outfit suggestions with reasons',
    body: 'Looks built from your profile, each explaining why it suits you.',
  },
  { Icon: Palette, title: 'My Colour Palette', body: 'Palettes shaped by your colour choices and optional signals.' },
  { Icon: ShoppingBag, title: 'Shop My Look', body: 'Save items you find and compare the total with your budget.' },
  { Icon: Camera, title: 'Virtual Try-On', body: 'See how a look could come together before you buy.' },
  { Icon: PencilRuler, title: 'Design Studio', body: 'Sketch and refine custom pieces for your tailor.' },
  { Icon: MessageCircle, title: 'Style Assistant', body: 'Ask styling questions in plain language.' },
];

const FAQ = [
  {
    q: 'Is StyleMe free?',
    a: 'Yes. StyleMe is currently in beta and free to use.',
  },
  {
    q: 'Can anyone sign up?',
    a: 'Yes. Sign up with your email address (we send a 6-digit code to verify it) or with Google.',
  },
  {
    q: 'Do I have to share photos or my skin tone?',
    a: 'No. Appearance signals are optional, self-reported and can be deleted at any time. StyleMe does not ask for photos.',
  },
  {
    q: 'Does StyleMe sell clothes?',
    a: 'No. StyleMe is a styling guide. Shop My Look will let you save items you find elsewhere and compare them with your budget — it is coming soon.',
  },
  {
    q: 'How is my data protected?',
    a: 'Passwords are hashed, sessions can be ended at any time, and you can delete your account permanently from Settings. See the Privacy Policy for details.',
  },
  {
    q: 'Which features are available today?',
    a: 'Account sign-up, your style profile and optional appearance signals. Outfit suggestions, palettes, try-on, design studio and the style assistant are marked "Coming soon".',
  },
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const { heroIndian, heroWestern, styling, categoryIndian, categoryFusion, categoryWestern } = BRAND_IMAGES;
  return (
    <>
      {deleted && (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <Alert tone="success">Your account and its data have been permanently deleted.</Alert>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="space-y-7">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Personal styling for India</p>
            <h1 className="font-display text-5xl leading-[1.05] text-primary sm:text-6xl">
              Discover the Style That Is <span className="italic text-accent">You</span>.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Build a style profile around your sizes, fit, colours and comfort — the foundation for outfit ideas that
              fit your life and your budget, each with a reason.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  Get Started <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/#how-it-works">How it works</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Open public beta · free to get started</p>
          </div>
          <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
            <div className="relative mt-10 aspect-[2/3] overflow-hidden rounded-[2rem] shadow-xl">
              <Image
                src={heroIndian.src}
                alt={heroIndian.alt}
                fill
                priority
                sizes="(min-width: 768px) 25vw, 45vw"
                className="object-cover"
                style={{ objectPosition: heroIndian.position }}
              />
            </div>
            <div className="relative aspect-[2/3] overflow-hidden rounded-[2rem] shadow-xl">
              <Image
                src={heroWestern.src}
                alt={heroWestern.alt}
                fill
                priority
                sizes="(min-width: 768px) 25vw, 45vw"
                className="object-cover"
                style={{ objectPosition: heroWestern.position }}
              />
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-surface px-5 py-2 text-sm shadow-lg">
              <span className="font-display italic text-primary">Indian · Fusion · Western</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 bg-surface-muted py-20">
        <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
          <SectionHeading eyebrow="How it works" title="From sign-up to your personalized home" />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="space-y-3 rounded-2xl bg-surface p-6 shadow-sm">
                <span className="font-display text-3xl text-accent">{s.n}</span>
                <h3 className="font-display text-xl text-primary">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Personalized styling */}
      <section id="features" className="scroll-mt-20 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 md:grid-cols-[1fr_1.2fr]">
          <div className="relative mx-auto aspect-[2/3] w-full max-w-md overflow-hidden rounded-[2rem] shadow-xl">
            <Image
              src={styling.src}
              alt={styling.alt}
              fill
              sizes="(min-width: 768px) 40vw, 90vw"
              className="object-cover"
              style={{ objectPosition: styling.position }}
            />
          </div>
          <div className="space-y-8">
            <SectionHeading
              align="left"
              eyebrow="Personalized styling"
              title="A profile that understands how you dress"
              body="Everything you tell StyleMe is explained: why it is asked and how it is used. Change or delete it at any time."
            />
            <ul className="grid gap-5 sm:grid-cols-2">
              {PERSONAL.map((p) => (
                <li key={p.title} className="space-y-1.5 border-l-2 border-accent pl-4">
                  <h3 className="font-medium text-foreground">{p.title}</h3>
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <UserRound aria-hidden className="size-4 text-plum" />
              Available today: style profile and optional appearance signals.
            </div>
          </div>
        </div>
      </section>

      {/* Fashion categories */}
      <section className="bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
          <SectionHeading light eyebrow="Fashion categories" title="Indian, fusion and western — all in one profile" />
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { img: categoryIndian, title: 'Indian', body: 'Sarees, kurtas, lehengas and festive wear.' },
              { img: categoryFusion, title: 'Fusion', body: 'Co-ord sets, jackets over kurtas and indo-western cuts.' },
              { img: categoryWestern, title: 'Western', body: 'Tailoring, shirts, denim and everyday essentials.' },
            ].map((c) => (
              <figure key={c.title} className="group overflow-hidden rounded-2xl bg-primary-hover">
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src={c.img.src}
                    alt={c.img.alt}
                    fill
                    sizes="(min-width: 768px) 30vw, 90vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    style={{ objectPosition: c.img.position }}
                  />
                </div>
                <figcaption className="space-y-1 p-5">
                  <p className="font-display text-2xl">{c.title}</p>
                  <p className="text-sm text-primary-foreground/75">{c.body}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Lookbook: inspiration only, never products (FR-DATA-06) */}
      <section id="lookbook" className="scroll-mt-20 bg-surface-muted py-20">
        <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
          <SectionHeading
            eyebrow="Lookbook"
            title="Looks that start with you"
            body="Everyday, office and festive outfits that inspire how StyleMe thinks about colour, fit and proportion."
          />
          <ul className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
            {LOOKBOOK_IMAGES.map((img, i) => (
              <li
                key={img.src}
                className={`group relative aspect-[2/3] overflow-hidden rounded-2xl shadow-md ${i % 2 === 1 ? 'md:translate-y-8' : ''}`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  style={{ objectPosition: img.position }}
                />
              </li>
            ))}
          </ul>
          <p className="pt-4 text-center text-xs text-muted-foreground md:pt-8">
            Inspiration only — StyleMe is a styling guide and doesn&rsquo;t sell these outfits.
          </p>
        </div>
      </section>

      {/* Budget-based shopping */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl space-y-8 px-4 text-center sm:px-6">
          <Wallet aria-hidden className="mx-auto size-10 text-accent" />
          <SectionHeading
            eyebrow="Budget-based shopping"
            title="Style that respects your budget"
            body="Set a budget per look in your style profile today. With Shop My Look you will save items you find in any store, with their prices, and see how the total compares with your budget."
          />
          <Badge>Shop My Look — coming soon</Badge>
        </div>
      </section>

      {/* Upcoming features */}
      <section className="bg-surface-muted py-20">
        <div className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
          <SectionHeading eyebrow="Upcoming features" title="What we are building next" />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {UPCOMING.map(({ Icon, title, body }) => (
              <li key={title} className="space-y-3 rounded-2xl border border-border bg-surface p-6">
                <div className="flex items-center justify-between">
                  <Icon aria-hidden className="size-6 text-plum" />
                  <Badge>Coming soon</Badge>
                </div>
                <h3 className="font-display text-xl text-primary">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-3xl space-y-10 px-4 sm:px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-foreground">
                  {f.q}
                  <span aria-hidden className="text-xl text-accent transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="space-y-4 rounded-2xl bg-primary p-8 text-center text-primary-foreground">
            <p className="font-display text-3xl">Ready to discover your style?</p>
            <Button asChild variant="accent" size="lg">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'center',
  light = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  align?: 'center' | 'left';
  light?: boolean;
}) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl space-y-3 text-center' : 'space-y-3'}>
      <p className={`text-xs font-medium uppercase tracking-[0.3em] ${light ? 'text-accent' : 'text-plum'}`}>
        {eyebrow}
      </p>
      <h2 className={`font-display text-4xl leading-tight ${light ? 'text-primary-foreground' : 'text-primary'}`}>
        {title}
      </h2>
      {body && <p className={light ? 'text-primary-foreground/75' : 'text-muted-foreground'}>{body}</p>}
    </div>
  );
}
