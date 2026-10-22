import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// The StyleMe logo (founder decision 2026-10-22, D-130): the plum-and-gold "StyleMe · Style Partner" artwork
// is the only logo used across the app — no separate wordmark text. The icons (app/icon.png,
// app/apple-icon.png, public/favicon.ico) use its circular emblem.
//
// Both files are cut from `styleme-logo.png` with a transparent background and a tight crop, so the logo
// sits directly on the page instead of in a dark box: the original gold wordmark on aubergine surfaces,
// and an aubergine wordmark with a deeper gold tagline on ivory surfaces.

export interface LogoProps {
  href?: string;
  /** True on dark (aubergine) surfaces and over photos: the gold wordmark. Otherwise the aubergine wordmark. */
  light?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
}

const HEIGHT = { sm: 'h-10', md: 'h-14', lg: 'h-20' } as const;

export function Logo({ href = '/', light = false, className, size = 'md', priority = false }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label="StyleMe home"
      className={cn('inline-flex shrink-0 items-center transition-opacity hover:opacity-90', className)}
    >
      <Image
        src={light ? '/images/styleme-logo-on-dark.png' : '/images/styleme-logo-on-light.png'}
        alt="StyleMe — Style Partner"
        width={866}
        height={391}
        priority={priority}
        className={cn('w-auto', HEIGHT[size])}
      />
    </Link>
  );
}
