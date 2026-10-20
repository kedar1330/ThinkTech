'use client';

import { useActionState, useState } from 'react';
import { removeShortlistItemAction } from '@/app/actions/shortlist';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/** Remove one item, after an explicit confirmation (FR-LIST-04). There is no undo: add it again instead. */
export function RemoveShortlistItem({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(removeShortlistItemAction, undefined);
  const [asking, setAsking] = useState(false);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={pending ? undefined : `Remove ${name}`}
        onClick={() => setAsking(true)}
      >
        {pending ? (
          <>
            <Spinner /> Removing…
          </>
        ) : (
          'Remove'
        )}
      </Button>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        tone="danger"
        title="Remove this item?"
        description={
          <>
            <span className="font-medium text-foreground">{name}</span> will be removed from your shortlist. To keep it,
            you would need to add it again.
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={() => setAsking(false)} autoFocus>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" onClick={() => setAsking(false)}>
            Yes, remove
          </Button>
        </div>
      </Dialog>
    </form>
  );
}
