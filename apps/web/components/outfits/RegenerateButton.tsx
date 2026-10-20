'use client';

import { useActionState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ProfileSizes } from '@styleme/contracts';
import { regenerateAction } from '@/app/actions/discover';
import { uniqueLooks } from '@/lib/discover/results';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { LookCard } from './LookCard';
import { ResultFlags } from './ResultFlags';
import { WhatChanged } from './WhatChanged';

/**
 * "Regenerate with my current profile" (#49) on the results page and a saved look. Re-runs the look's
 * original request with the latest profile; until then it shows `children` (the current looks), and after
 * it the new looks with "What changed". Regenerating again starts from the newest looks.
 */
export function RegenerateButton({
  outfitId,
  sizes,
  children,
}: {
  outfitId: string;
  sizes: ProfileSizes;
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(regenerateAction, undefined);
  const result = state?.result;
  const looks = result ? uniqueLooks(result.looks) : [];
  const from = looks[0]?.id ?? outfitId;

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-2">
        <input type="hidden" name="outfitId" value={from} />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="h-auto min-h-11 w-full whitespace-normal py-2 sm:w-auto"
        >
          {pending ? <Spinner /> : <RefreshCw aria-hidden />}
          {pending ? 'Regenerating…' : 'Regenerate with my current profile'}
        </Button>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
      </form>

      {result ? (
        <section aria-label="Regenerated looks" className="space-y-4">
          <WhatChanged changes={state.changes ?? []} />
          <ResultFlags result={result} />
          {looks.map((look, i) => (
            <LookCard key={look.id} look={look} position={i + 1} sizes={sizes} />
          ))}
        </section>
      ) : (
        children
      )}
    </div>
  );
}
