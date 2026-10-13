'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Heart,
  House,
  LogOut,
  Menu,
  MessageCircle,
  Palette,
  PencilRuler,
  Settings,
  Shirt,
  ShoppingBag,
  Sparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Logo } from '@/components/site/Logo';
import { FEATURES, featureHref, type FeatureIcon } from '@/lib/features';
import { cn } from '@/lib/utils';

const ICONS: Record<FeatureIcon, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  shirt: Shirt,
  bag: ShoppingBag,
  camera: Camera,
  ruler: PencilRuler,
  chat: MessageCircle,
  heart: Heart,
};

const COLLAPSE_KEY = 'styleme.sidebar-collapsed';

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: '/home', label: 'Home', Icon: House },
  ...FEATURES.map((f) => ({ href: featureHref(f), label: f.label, Icon: ICONS[f.icon], soon: !f.href })),
];

/**
 * Signed-in layout: a sidebar that collapses to icons on desktop (remembered per browser) and becomes a
 * drawer behind a hamburger button on small screens.
 */
export function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      // storage unavailable: start expanded
    }
  }, []);
  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [drawer]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        // ignore
      }
      return !c;
    });

  const nav = (compact: boolean) => (
    <nav aria-label="StyleMe" className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {NAV.map(({ href, label, Icon, soon }) => {
        const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            title={compact ? `${label}${soon ? ' (coming soon)' : ''}` : undefined}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-primary-foreground/12 text-primary-foreground'
                : 'text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground',
              compact && 'justify-center px-0',
            )}
          >
            <Icon aria-hidden className={cn('size-[18px] shrink-0', active && 'text-accent')} />
            {compact ? (
              <span className="sr-only">
                {label}
                {soon && ' (coming soon)'}
              </span>
            ) : (
              <>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span>{label}</span>
                  {soon && (
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-accent">
                      Coming soon
                    </span>
                  )}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (compact: boolean) => (
    <div className="space-y-1 border-t border-primary-foreground/15 px-3 py-4">
      <Link
        href="/settings"
        aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
        title={compact ? 'Settings' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground',
          compact && 'justify-center px-0',
        )}
      >
        <Settings aria-hidden className="size-[18px]" />
        <span className={compact ? 'sr-only' : ''}>Settings</span>
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          title={compact ? 'Log out' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary-foreground/75 hover:bg-primary-foreground/8 hover:text-primary-foreground',
            compact && 'justify-center px-0',
          )}
        >
          <LogOut aria-hidden className="size-[18px]" />
          <span className={compact ? 'sr-only' : ''}>Log out</span>
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col bg-primary text-primary-foreground transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center px-5', collapsed && 'justify-center px-0')}>
          {collapsed ? (
            <Link href="/home" aria-label="StyleMe home" className="font-display text-2xl italic text-accent">
              S
            </Link>
          ) : (
            <Logo href="/home" light />
          )}
        </div>
        {nav(collapsed)}
        {footer(collapsed)}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="flex h-11 items-center justify-center border-t border-primary-foreground/15 text-primary-foreground/70 hover:text-primary-foreground"
        >
          {collapsed ? (
            <ChevronsRight aria-hidden className="size-4" />
          ) : (
            <ChevronsLeft aria-hidden className="size-4" />
          )}
        </button>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          aria-expanded={drawer}
          aria-controls="app-drawer"
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted"
        >
          <Menu aria-hidden className="size-5" />
        </button>
        <Logo href="/home" />
        <span className="size-10" aria-hidden />
      </div>
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setDrawer(false)}
          />
          <aside
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-primary text-primary-foreground shadow-xl"
          >
            <div className="flex h-14 items-center justify-between px-5">
              <Logo href="/home" light />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
                className="inline-flex size-9 items-center justify-center rounded-full hover:bg-primary-foreground/10"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {nav(false)}
            {footer(false)}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="hidden h-16 items-center justify-end border-b border-border px-8 lg:flex">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{userName}</span>
          </p>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
