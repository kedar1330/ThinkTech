'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { deleteDesignAction, renderDesignAction } from '@/app/actions/design-studio';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Print (or save as PDF) for the tailor, draw the picture again, or delete the design. */
export function DesignActions({ designId, pictureFailed }: { designId: string; pictureFailed: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ error?: string; success?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const redraw = () =>
    startTransition(async () => {
      setMessage(null);
      const result = await renderDesignAction(designId);
      setMessage(result);
      if (!result.error) router.refresh();
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deleteDesignAction(designId);
      if (result?.error) setMessage(result);
    });

  return (
    <div className="space-y-2 print:hidden">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" onClick={() => window.print()}>
          <Printer /> Print or save as PDF
        </Button>
        <Button type="button" variant="outline" onClick={redraw} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          {pictureFailed ? 'Try the picture again' : 'Draw another version'}
        </Button>
        {confirming ? (
          <Button type="button" variant="outline" onClick={remove} disabled={pending} className="text-destructive">
            <Trash2 /> Yes, delete
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirming(true)} disabled={pending}>
            <Trash2 /> Delete
          </Button>
        )}
      </div>
      <p role="status" className={cn('min-h-5 text-sm', message?.error ? 'text-destructive' : 'text-success')}>
        {pending ? 'Drawing… this can take up to a minute.' : (message?.error ?? message?.success ?? '')}
      </p>
    </div>
  );
}
