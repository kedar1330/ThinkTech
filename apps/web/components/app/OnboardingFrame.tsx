import { Check } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Logo } from '@/components/site/Logo';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'verify', label: 'Account' },
  { id: 'style_profile', label: 'Style profile' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'complete', label: 'Your home' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

/** Onboarding page frame with a progress indicator (Registration → Verify → Style → Appearance → Home). */
export function OnboardingFrame({
  current,
  title,
  intro,
  children,
}: {
  current: StepId;
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  const index = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href="/" />
          <form action={logoutAction}>
            <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
        <ol className="grid grid-cols-4 gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s.id} className="space-y-2" aria-current={i === index ? 'step' : undefined}>
              <span
                className={cn(
                  'block h-1.5 rounded-full',
                  i < index ? 'bg-plum' : i === index ? 'bg-accent' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  i <= index ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {i < index && <Check aria-hidden className="size-3 text-plum" />}
                {s.label}
                <span className="sr-only">{i < index ? ' (done)' : i === index ? ' (current step)' : ''}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="space-y-2">
          <h1 className="font-display text-4xl text-primary">{title}</h1>
          {intro && <div className="text-muted-foreground">{intro}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
