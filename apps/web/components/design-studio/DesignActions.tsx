'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Printer, RefreshCw, ShoppingBag, Trash2 } from 'lucide-react';
import { deleteDesignAction, renderDesignAction } from '@/app/actions/design-studio';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Print (or save as PDF) for the tailor, draw the picture again, shop, try-on, or delete the design. */
export function DesignActions({
  designId,
  pictureFailed,
  lookId,
}: {
  designId: string;
  pictureFailed: boolean;
  lookId?: string;
}) {
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
        <Button asChild variant="outline" className="border-plum/40 text-plum hover:bg-plum/10">
          <Link href={lookId ? `/shop?outfitId=${lookId}` : `/shop?designId=${designId}`}>
            <ShoppingBag className="size-4" /> Shop this look
          </Link>
        </Button>
        <Button asChild variant="outline" className="border-plum/40 text-plum hover:bg-plum/10">
          <Link href={lookId ? `/try-on?outfitId=${lookId}` : `/try-on?designId=${designId}`}>
            <Camera className="size-4" /> Virtual Try-On
          </Link>
        </Button>
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
