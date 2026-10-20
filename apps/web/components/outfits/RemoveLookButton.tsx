'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { removeOutfitAction } from '@/app/actions/outfits';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

/** Remove a look, only after the user confirms (FR-OUT-03). `from` says where to go afterwards. */
export function RemoveLookButton({
  outfitId,
  lookName,
  from,
}: {
  outfitId: string;
  lookName: string;
  from: 'list' | 'detail';
}) {
  const [asking, setAsking] = useState(false);
  const [state, action, pending] = useActionState(removeOutfitAction, undefined);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setAsking(true)}
        disabled={pending}
        aria-label={`Remove ${lookName}`}
      >
        <Trash2 aria-hidden />
        {pending ? 'Removing…' : 'Remove'}
      </Button>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        tone="danger"
        title="Remove this look?"
        description={`${lookName} will be removed from Saved Outfits. This cannot be undone.`}
      >
        <form action={action} className="grid grid-cols-2 gap-3">
          <input type="hidden" name="outfitId" value={outfitId} />
          <input type="hidden" name="from" value={from} />
          <Button type="button" variant="outline" onClick={() => setAsking(false)} autoFocus>
            Cancel
          </Button>
          <Button type="submit" variant="destructive" onClick={() => setAsking(false)}>
            Remove look
          </Button>
        </form>
      </Dialog>
    </div>
  );
}
