'use client';

import { useState, useTransition } from 'react';
import type { AppearanceResponse } from '@styleme/contracts';
import { clearAppearanceAction, setUseInRecommendationsAction } from '@/app/actions/appearance';
import type { FormState } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Status } from '@/components/profile/AppearanceShared';

/** "Use in recommendations" (FR-SIG-03) and clearing skin tone, undertone and body type. */
export function AppearanceSettings({ appearance }: { appearance: AppearanceResponse }) {
  const [state, setState] = useState<FormState>(undefined);
  const [pending, startTransition] = useTransition();
  const hasAny = Boolean(appearance.skinTone || appearance.undertone || appearance.bodyType);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          defaultChecked={appearance.useInRecommendations}
          disabled={pending}
          onChange={(e) => {
            const on = e.target.checked;
            startTransition(async () => setState(await setUseInRecommendationsAction(on)));
          }}
        />
        Use my skin tone, undertone and body type in recommendations
      </label>
      {hasAny ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(async () => setState(await clearAppearanceAction()))}
        >
          Clear skin tone, undertone and body type
        </Button>
      ) : null}
      <Status state={state} />
    </div>
  );
}
