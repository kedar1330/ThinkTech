import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-surface p-6 shadow-xs transition-all duration-300',
        className,
      )}
      {...props}
    />
  );
}
