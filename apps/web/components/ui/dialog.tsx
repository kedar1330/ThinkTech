'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Modal dialog on the native `<dialog>` element: the browser traps focus, Escape closes it and the page
 * behind is inert. `open` is controlled by the parent.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  tone = 'default',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  tone?: 'default' | 'danger';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        'm-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border bg-surface p-6 text-foreground shadow-xl backdrop:bg-foreground/50',
        tone === 'danger' ? 'border-destructive/30' : 'border-border',
      )}
    >
      <div className="space-y-4">
        <h2
          id={titleId}
          className={cn('font-display text-2xl', tone === 'danger' ? 'text-destructive' : 'text-primary')}
        >
          {title}
        </h2>
        {description && (
          <div id={descriptionId} className="text-sm text-muted-foreground">
            {description}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
