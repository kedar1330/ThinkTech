'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { saveOutfitAction } from '@/app/actions/outfits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * "Save to Saved Outfits" on a generated look (FR-OUT-01, #47). Saving removes the look's 7-day expiry;
 * saving again is harmless. After saving, it links to the look in Saved Outfits.
 */
export function SaveLookButton({ outfitId, saved = false }: { outfitId: string; saved?: boolean }) {
  const [state, action, pending] = useActionState(saveOutfitAction, undefined);
  const isSaved = saved || Boolean(state?.success);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="outfitId" value={outfitId} />
      {isSaved ? (
        <p role="status" className="text-sm">
          {state?.success ?? 'Saved to Saved Outfits.'}{' '}
          <Link href={`/saved/${outfitId}`} className="font-medium text-plum underline">
            View in Saved Outfits
          </Link>
        </p>
      ) : (
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? <Spinner /> : <Heart aria-hidden />}
          {pending ? 'Saving…' : 'Save to Saved Outfits'}
        </Button>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
