'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Logo } from './Logo';

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#features', label: 'Features' },
  { href: '/about', label: 'About' },
] as const;

/** Public navigation. On small screens the links collapse into a hamburger menu. */
export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-foreground/80 transition-colors hover:text-primary">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href="/home">My StyleMe</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full text-foreground hover:bg-surface-muted md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
        </button>
      </div>
      <div
        id="mobile-menu"
        hidden={!open}
        className={cn('border-t border-border bg-background px-4 pb-6 pt-2 md:hidden')}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-border/60 py-3 text-base text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {signedIn ? (
            <Button asChild className="col-span-2">
              <Link href="/home">My StyleMe</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
