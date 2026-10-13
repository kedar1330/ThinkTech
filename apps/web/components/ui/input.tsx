import * as React from 'react';
import { cn } from '@/lib/utils';

const inputClass =
  'flex h-11 w-full rounded-lg border border-input bg-surface px-3.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/80 focus-visible:border-plum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export { Input, inputClass };
