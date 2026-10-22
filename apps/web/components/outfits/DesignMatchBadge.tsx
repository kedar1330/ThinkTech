import { Check } from 'lucide-react';
import type { DesignMatch } from '@styleme/contracts';
import { cn } from '@/lib/utils';

// How a look compares with the design it was requested for (D-132).

const ATTRIBUTE_LABEL: Record<DesignMatch['differs'][number], string> = {
  neckline: 'neckline',
  sleeve: 'sleeves',
  fit: 'fit',
  silhouette: 'shape',
  length: 'length',
};

export function designMatchText(match: DesignMatch): string {
  if (match.level === 'full') return 'Matches your design';
  if (match.level === 'partial')
    return `Close match: different ${match.differs.map((d) => ATTRIBUTE_LABEL[d]).join(', ')}`;
  return 'Different garment';
}

export function DesignMatchBadge({ match }: { match: DesignMatch }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        match.level === 'full' && 'bg-success-soft text-success',
        match.level === 'partial' && 'bg-warning-soft text-foreground',
        match.level === 'none' && 'bg-surface-muted text-muted-foreground',
      )}
    >
      {match.level === 'full' && <Check aria-hidden className="size-3.5" />}
      {designMatchText(match)}
    </span>
  );
}
