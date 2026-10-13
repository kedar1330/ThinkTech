import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'error' | 'success' | 'info';

const TONE: Record<Tone, { box: string; Icon: typeof Info }> = {
  error: { box: 'border-destructive/30 bg-error-soft text-destructive', Icon: AlertCircle },
  success: { box: 'border-success/30 bg-success-soft text-success', Icon: CheckCircle2 },
  info: { box: 'border-accent/40 bg-warning-soft text-accent-foreground', Icon: Info },
};

/** Inline message. Errors are announced (role=alert); success and info are polite (role=status). */
export function Alert({
  tone = 'info',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  const { box, Icon } = TONE[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', box, className)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1 [&_a]:font-medium [&_a]:underline">{children}</div>
    </div>
  );
}
