import { cn } from '@/lib/utils';

export function Checkbox({
  id,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'> & { id: string; label: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-input accent-[#4a1f45]"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-foreground">
        {label}
      </label>
    </div>
  );
}
