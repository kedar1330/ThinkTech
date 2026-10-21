import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FieldPrivacyNoteProps {
  /** What this optional data is used for. */
  usedFor: React.ReactNode;
  /** Who sees this data. Defaults to private / no external AI. */
  whoSees?: React.ReactNode;
  /** How this data can be deleted. Defaults to self-service change or account deletion. */
  howToDelete?: React.ReactNode;
  /** Additional custom notes or details. */
  children?: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Reusable per-field privacy notice for optional data (appearance signals, budget, shortlist).
 * Explains what the data is used for, who sees it, and how to delete it.
 * Marked provisional until the qualified legal review (D-74) is complete.
 */
export function FieldPrivacyNote({
  usedFor,
  whoSees = 'Private to you. Never shared with other users and never sent to external AI.',
  howToDelete = 'You can change or clear this at any time, and it is permanently deleted if you delete your account.',
  children,
  className,
  id,
}: FieldPrivacyNoteProps) {
  return (
    <aside
      id={id}
      aria-label="Privacy and data use"
      className={cn(
        'rounded-xl border border-border/70 bg-surface/60 p-3.5 text-xs text-muted-foreground shadow-xs space-y-2',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-medium text-foreground">Privacy &amp; data use</span>
        <Badge className="text-[10px] font-normal tracking-wide">Provisional — pending legal review</Badge>
      </div>
      <dl className="space-y-1.5 leading-relaxed">
        <div>
          <dt className="inline font-medium text-foreground/80">Used for: </dt>
          <dd className="inline">{usedFor}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground/80">Who sees it: </dt>
          <dd className="inline">{whoSees}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-foreground/80">How to delete: </dt>
          <dd className="inline">{howToDelete}</dd>
        </div>
      </dl>
      {children}
    </aside>
  );
}
