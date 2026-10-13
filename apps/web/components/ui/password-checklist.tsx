import { Check, Circle } from 'lucide-react';
import { passwordRuleResults } from '@styleme/contracts';
import { cn } from '@/lib/utils';

/** Live password-rule checklist (D-87). Rules only — deliberately no strength label. */
export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  const results = passwordRuleResults(password);
  return (
    <ul id={id} className="grid gap-1 text-xs sm:grid-cols-2" aria-label="Password requirements">
      {results.map((rule) => (
        <li
          key={rule.id}
          className={cn('flex items-center gap-1.5', rule.met ? 'text-success' : 'text-muted-foreground')}
        >
          {rule.met ? <Check aria-hidden className="size-3.5" /> : <Circle aria-hidden className="size-3" />}
          <span>
            {rule.label}
            <span className="sr-only">{rule.met ? ' — met' : ' — not met yet'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
