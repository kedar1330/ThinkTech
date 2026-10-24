'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { removeOutfitAction } from '@/app/actions/outfits';

function useOptionalRouter() {
  try {
    return useRouter();
  } catch {
    return null;
  }
}

export function DeleteSavedLookButton({
  outfitId,
  lookName,
  isSelected,
}: {
  outfitId: string;
  lookName: string;
  isSelected?: boolean;
}) {
  const router = useOptionalRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set('outfitId', outfitId);
      const result = await removeOutfitAction({}, formData);
      if (result?.success) {
        if (isSelected) {
          router?.push('/shop');
        } else {
          router?.refresh();
        }
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          disabled={pending}
          onClick={handleDelete}
          className="inline-flex h-7 items-center justify-center rounded-lg bg-destructive px-2 text-[10px] font-semibold text-white transition hover:bg-destructive/90 disabled:opacity-50"
          title="Confirm remove"
          aria-label={`Confirm delete ${lookName}`}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : 'Delete'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
          className="inline-flex h-7 items-center justify-center rounded-lg border border-border bg-surface px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      title="Delete saved look"
      aria-label={`Delete ${lookName}`}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-surface text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-3.5" />
    </button>
  );
}
