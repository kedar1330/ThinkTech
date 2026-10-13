import Image from 'next/image';
import { BRAND_IMAGES } from '@/lib/brand/images';
import { Logo } from './Logo';

/**
 * Split-screen layout for sign-up, login and verification: the brand image and tagline on the left
 * (hidden on small screens, where a compact brand band shows instead), the form on the right.
 */
export function AuthSplitLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const image = BRAND_IMAGES.auth;
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-primary lg:block">
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="50vw"
          className="object-cover"
          style={{ objectPosition: image.position }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 top-0 p-10">
          <Logo light />
        </div>
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-10 text-primary-foreground">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">StyleMe</p>
          <p className="max-w-md font-display text-4xl leading-tight xl:text-5xl">Discover the Style That Is You.</p>
          <p className="max-w-md text-sm text-primary-foreground/80">
            A style profile, your colours and fit, and outfit ideas within your budget — each with a reason.
          </p>
          <p className="pt-4 text-[11px] text-primary-foreground/50">Photo: {image.credit}</p>
        </div>
      </aside>
      <main id="main" className="flex flex-col">
        {/* Small screens: the same photograph, stacked above the form as a short banner. */}
        <div className="relative h-52 overflow-hidden bg-primary sm:h-64 lg:hidden">
          <Image src={image.src} alt={image.alt} fill priority sizes="100vw" className="object-cover object-[50%_3%]" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/45 to-primary/10" />
          <div className="absolute inset-x-0 top-0 px-4 py-4">
            <Logo light />
          </div>
          <p className="absolute inset-x-0 bottom-0 px-4 pb-4 font-display text-2xl leading-tight text-primary-foreground">
            Discover the Style That Is You.
          </p>
        </div>
        <div className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:py-14">
          <div className="w-full max-w-md space-y-7">
            <div className="space-y-2">
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">{title}</h1>
              {subtitle && <div className="text-sm text-muted-foreground">{subtitle}</div>}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
