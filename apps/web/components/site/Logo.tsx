import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ href = '/', light = false, className }: { href?: string; light?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      className={cn('inline-flex items-baseline gap-0.5 font-display text-2xl tracking-tight', className)}
      aria-label="StyleMe home"
    >
      <span className={light ? 'text-primary-foreground' : 'text-primary'}>Style</span>
      <span className="italic text-accent">Me</span>
    </Link>
  );
}
