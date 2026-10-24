import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Button animations (#139): colour, shadow and movement ease together; buttons press down on click, filled
// and outline ones lift on hover, and primary and accent ones get a light shine (`.btn-shine` in
// globals.css). A trailing icon nudges forward. Movement is `motion-safe` only, so with reduced motion just
// the colour changes remain. Tailwind 4 moves with the `translate` and `scale` properties, not `transform`.
const MOTION =
  'transition-[color,background-color,border-color,box-shadow,translate,scale] duration-200 ease-out motion-safe:active:scale-[0.97] [&>svg:last-child:not(:first-child)]:transition-[translate] [&>svg:last-child:not(:first-child)]:duration-200 motion-safe:hover:[&>svg:last-child:not(:first-child)]:translate-x-0.5';
const LIFT = 'motion-safe:hover:-translate-y-px';

const buttonVariants = cva(
  `relative isolate overflow-hidden inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide ${MOTION} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        default: `btn-shine bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover hover:shadow-md ${LIFT}`,
        accent: `btn-shine bg-accent text-accent-foreground shadow-sm hover:bg-accent/90 hover:shadow-md ${LIFT}`,
        destructive: `bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md ${LIFT}`,
        outline: `border border-input bg-surface text-foreground hover:bg-surface-muted hover:shadow-sm ${LIFT}`,
        ghost: 'text-foreground hover:bg-surface-muted',
        // Text links stay calm: no press scale, lift or shine.
        link: 'rounded-none px-0 text-plum underline underline-offset-4 hover:no-underline motion-safe:active:scale-100',
      },
      size: {
        default: 'h-11 px-6',
        sm: 'h-9 px-4',
        lg: 'h-12 px-8 text-base',
        icon: 'size-10',
        full: 'h-11 w-full px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
