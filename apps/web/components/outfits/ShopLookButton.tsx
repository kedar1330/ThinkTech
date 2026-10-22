'use client';

import { useActionState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { shopLookAction } from '@/app/actions/outfits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * "Shop this look" on a Discover My Style result (#115). Saving is a state change, so this is a form, not a
 * link: the look is saved, becomes a Shop My Look tab, and opens there.
 */
export function ShopLookButton({ outfitId }: { outfitId: string }) {
  const [state, action, pending] = useActionState(shopLookAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="outfitId" value={outfitId} />
      <Button type="submit" variant="link" className="min-h-11" disabled={pending}>
        {pending ? <Spinner /> : <ShoppingBag aria-hidden />}
        Shop this look
      </Button>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
    </form>
  );
}
