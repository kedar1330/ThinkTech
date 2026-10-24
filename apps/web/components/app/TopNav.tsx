'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Camera,
  ChevronDown,
  Heart,
  House,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Palette,
  PencilRuler,
  Settings,
  ShieldAlert,
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

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  soon: boolean;
}

/** In priority order: when space runs out, items move into "More" from the end of this list. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/home', label: 'Home', Icon: House, soon: false },
  ...FEATURES.map((f) => ({ href: featureHref(f), label: f.label, Icon: ICONS[f.icon], soon: !f.href })),
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/home' && pathname.startsWith(`${href}/`));
}

/** How many items fit: each item's width plus gaps, leaving room for "More" when some don't fit. */
export function fitCount(itemWidths: number[], available: number, moreWidth: number, gap: number): number {
  const total = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
  if (total <= available) return itemWidths.length;
  let used = 0;
  let count = 0;
  for (const w of itemWidths) {
    const next = used + (count > 0 ? gap : 0) + w;
    if (next + gap + moreWidth > available) break;
    used = next;
    count += 1;
  }
  return count;
}

/** Closes a popup on Escape (returning focus to its trigger) or on a click outside it. */
function useDismiss(
  open: boolean,
  close: () => void,
  containerRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close, containerRef, triggerRef]);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?';
}

function SoonTag({ className }: { className?: string }) {
  return (
    <span className={cn('text-[10px] font-semibold uppercase tracking-[0.14em] text-accent', className)}>
      Coming soon
    </span>
  );
}

/** One row in the "More" menu, the profile menu or the mobile drawer (light or dark surface). */
function MenuLink({ item, active, dark }: { item: NavItem; active: boolean; dark?: boolean }) {
  const { href, label, Icon, soon } = item;
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        dark
          ? active
            ? 'bg-primary-foreground/12 text-accent'
            : 'text-primary-foreground/85 hover:bg-primary-foreground/8 hover:text-primary-foreground'
          : active
            ? 'bg-accent-soft text-primary'
            : 'text-foreground hover:bg-surface-muted',
      )}
    >
      <Icon aria-hidden className={cn('size-[18px] shrink-0', active && (dark ? 'text-accent' : 'text-plum'))} />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className={cn(active && 'font-medium')}>{label}</span>
        {soon && <SoonTag className={cn('mt-0.5', !dark && 'text-plum')} />}
      </span>
    </Link>
  );
}

/** Width of the More menu (w-72), used to decide which way it opens. */
const MORE_MENU_WIDTH = 288;

const INLINE_ITEM =
  'relative flex h-16 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors';

/**
 * Signed-in top navigation (replaces the sidebar). From 640px the items sit in the bar and those that
 * don't fit the measured space move into "More"; below 640px a hamburger opens a drawer with every item.
 * Account actions live in the profile menu.
 */
export function TopNav({
  userName,
  userEmail,
  userRole,
  profileIncomplete = false,
}: {
  userName: string;
  userEmail: string;
  userRole?: string;
  /** Adds a dot on the avatar and a "Complete your profile" item to the account menus. */
  profileIncomplete?: boolean;
}) {
  const pathname = usePathname();

  // --- Inline items and "More" ---------------------------------------------------------------------
  const navRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // Before measuring (server render), show only the two most important items: they always fit.
  const [visible, setVisible] = useState(2);
  const [moreOpen, setMoreOpen] = useState(false);
  // Open the More menu towards whichever side has room for it.
  const [moreAlignRight, setMoreAlignRight] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const recalc = useCallback(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure || nav.clientWidth === 0) return;
    const widths = [...measure.querySelectorAll<HTMLElement>('[data-item]')].map((el) => el.offsetWidth);
    const moreWidth = measure.querySelector<HTMLElement>('[data-more]')?.offsetWidth ?? 0;
    setVisible(fitCount(widths, nav.clientWidth, moreWidth, 0));
  }, []);

  useLayoutEffect(() => {
    recalc();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(recalc);
    observer.observe(nav);
    // Web fonts change label widths once they load.
    void document.fonts?.ready.then(recalc);
    return () => observer.disconnect();
  }, [recalc]);

  const inline = NAV_ITEMS.slice(0, visible);
  const overflow = NAV_ITEMS.slice(visible);
  const overflowActive = overflow.some((i) => isActive(pathname, i.href));

  // --- Profile menu and mobile drawer --------------------------------------------------------------
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const closeMore = useCallback(() => setMoreOpen(false), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  useDismiss(moreOpen, closeMore, moreRef, moreButtonRef);
  useDismiss(profileOpen, closeProfile, profileRef, profileButtonRef);

  // Navigating closes every menu (state adjusted during render when the route changes).
  const [shownPath, setShownPath] = useState(pathname);
  if (shownPath !== pathname) {
    setShownPath(pathname);
    setMoreOpen(false);
    setProfileOpen(false);
    setDrawerOpen(false);
  }

  // Drawer: lock background scroll, move focus in, keep Tab inside, Escape closes, focus returns.
  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const trigger = hamburgerRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [drawerOpen]);

  // A wide screen has no drawer: close it if the window grows past the breakpoint.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 640px)');
    const onChange = () => query.matches && setDrawerOpen(false);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const settingsActive = pathname.startsWith('/settings');

  return (
    <header className="on-dark sticky top-0 z-40 bg-primary pt-[env(safe-area-inset-top)] text-primary-foreground shadow-[0_1px_0_rgb(200_164_92/0.35)]">
      <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-2 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-4 sm:px-6 lg:px-8">
        <Logo href="/home" light className="shrink-0" priority />

        {/* Inline navigation (640px and up) */}
        <nav aria-label="Main" className="relative hidden h-16 min-w-0 flex-1 items-center sm:flex">
          <div ref={navRef} className="flex h-16 min-w-0 flex-1 items-center">
            <ul className="flex h-16 min-w-0 items-center overflow-hidden">
              {inline.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href} className="h-16">
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        INLINE_ITEM,
                        active
                          ? 'text-accent after:bg-accent'
                          : 'text-primary-foreground/80 after:bg-transparent hover:text-primary-foreground hover:after:bg-primary-foreground/30',
                      )}
                    >
                      <item.Icon aria-hidden className="size-4 shrink-0" />
                      <span>{item.label}</span>
                      {item.soon && (
                        <>
                          <span
                            aria-hidden
                            title="Coming soon"
                            className="rounded-full border border-accent/50 px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wider text-accent"
                          >
                            Soon
                          </span>
                          <span className="sr-only">(coming soon)</span>
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
            {overflow.length > 0 && (
              <div ref={moreRef} className="relative h-16 shrink-0">
                <button
                  ref={moreButtonRef}
                  type="button"
                  aria-expanded={moreOpen}
                  aria-controls="nav-more"
                  onClick={() => {
                    const rect = moreButtonRef.current?.getBoundingClientRect();
                    setMoreAlignRight(Boolean(rect && rect.left + MORE_MENU_WIDTH > window.innerWidth - 8));
                    setMoreOpen((o) => !o);
                  }}
                  className={cn(
                    INLINE_ITEM,
                    overflowActive
                      ? 'text-accent after:bg-accent'
                      : 'text-primary-foreground/80 after:bg-transparent hover:text-primary-foreground',
                  )}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                  More
                  <span className="sr-only"> navigation ({overflow.length} items)</span>
                  <ChevronDown aria-hidden className={cn('size-4 transition-transform', moreOpen && 'rotate-180')} />
                </button>
                {moreOpen && (
                  <div
                    id="nav-more"
                    className={cn(
                      'menu-in absolute top-full z-50 mt-1 max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-surface p-2 text-foreground shadow-xl',
                      moreAlignRight ? 'right-0' : 'left-0',
                    )}
                  >
                    <ul className="space-y-0.5">
                      {overflow.map((item) => (
                        <li key={item.href}>
                          <MenuLink item={item} active={isActive(pathname, item.href)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Off-screen copy used only to measure item widths. */}
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden"
          >
            {NAV_ITEMS.map((item) => (
              <span key={item.href} data-item className={INLINE_ITEM}>
                <item.Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
                {item.soon && (
                  <span className="rounded-full border px-1.5 text-[9px] font-semibold uppercase leading-4 tracking-wider">
                    Soon
                  </span>
                )}
              </span>
            ))}
            <span data-more className={INLINE_ITEM}>
              <MoreHorizontal className="size-4" />
              More
              <ChevronDown className="size-4" />
            </span>
          </div>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          {/* Profile menu */}
          <div ref={profileRef} className="relative">
            <button
              ref={profileButtonRef}
              type="button"
              aria-expanded={profileOpen}
              aria-controls="profile-menu"
              aria-label={`Account menu for ${userName}${profileIncomplete ? ' (profile incomplete)' : ''}`}
              onClick={() => setProfileOpen((o) => !o)}
              className={cn(
                'flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-1 transition-colors hover:bg-primary-foreground/10 xl:pr-3',
                settingsActive && 'ring-1 ring-accent/70',
              )}
            >
              <span
                aria-hidden
                className="relative flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
              >
                {initials(userName)}
                {profileIncomplete && (
                  <span
                    data-testid="profile-incomplete-dot"
                    className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary-foreground ring-2 ring-primary"
                  />
                )}
              </span>
              <span aria-hidden className="hidden max-w-40 truncate text-sm xl:inline">
                {userName}
              </span>
              <ChevronDown aria-hidden className="hidden size-4 opacity-80 xl:block" />
            </button>
            {profileOpen && (
              <div
                id="profile-menu"
                className="menu-in absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface p-2 text-foreground shadow-xl"
              >
                <div className="border-b border-border px-3 pb-3 pt-2">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="break-all text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <ul className="space-y-0.5 pt-2">
                  {profileIncomplete && (
                    <li>
                      <Link
                        href="/profile#basics"
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-plum transition-colors hover:bg-surface-muted"
                      >
                        <ListChecks aria-hidden className="size-[18px]" /> Complete your profile
                      </Link>
                    </li>
                  )}
                  {userRole === 'admin' && (
                    <li>
                      <Link
                        href="/admin"
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-plum transition-colors hover:bg-surface-muted"
                      >
                        <ShieldAlert aria-hidden className="size-[18px]" /> Admin Panel
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link
                      href="/settings"
                      aria-current={settingsActive ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-surface-muted',
                        settingsActive && 'bg-accent-soft font-medium text-primary',
                      )}
                    >
                      <Settings aria-hidden className="size-[18px]" /> Settings
                    </Link>
                  </li>
                  <li>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-surface-muted"
                      >
                        <LogOut aria-hidden className="size-[18px]" /> Log out
                      </button>
                    </form>
                  </li>
                </ul>
              </div>
            )}
          </div>

          {/* Hamburger (below 640px) */}
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="nav-drawer"
            className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-primary-foreground/10 sm:hidden"
          >
            <Menu aria-hidden className="size-6" />
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            aria-hidden
            className="overlay-in absolute inset-0 bg-foreground/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            id="nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="on-dark drawer-in absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col bg-primary pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-primary-foreground shadow-2xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-primary-foreground/15 pl-5 pr-2">
              <Logo href="/home" light />
              <button
                type="button"
                data-autofocus
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-primary-foreground/10"
              >
                <X aria-hidden className="size-6" />
              </button>
            </div>
            <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
              <ul className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <MenuLink item={item} active={isActive(pathname, item.href)} dark />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="shrink-0 space-y-0.5 border-t border-primary-foreground/15 px-3 py-3">
              <p className="truncate px-3 pb-1 text-xs text-primary-foreground/70">Signed in as {userName}</p>
              {profileIncomplete && (
                <Link
                  href="/profile#basics"
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-accent hover:bg-primary-foreground/8"
                >
                  <ListChecks aria-hidden className="size-[18px]" /> Complete your profile
                </Link>
              )}
              {userRole === 'admin' && (
                <Link
                  href="/admin"
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-primary-foreground/8"
                >
                  <ShieldAlert aria-hidden className="size-[18px]" /> Admin Panel
                </Link>
              )}
              <Link
                href="/settings"
                aria-current={settingsActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-primary-foreground/8',
                  settingsActive ? 'text-accent' : 'text-primary-foreground/85',
                )}
              >
                <Settings aria-hidden className="size-[18px]" /> Settings
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-primary-foreground/85 hover:bg-primary-foreground/8"
                >
                  <LogOut aria-hidden className="size-[18px]" /> Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
