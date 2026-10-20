'use client';

import { useActionState, useState } from 'react';
import { Heart, ThumbsDown } from 'lucide-react';
import { FEEDBACK_REASONS, type FeedbackReasonId, type FeedbackValue, type LookFeedback } from '@styleme/contracts';
import { feedbackOutfitAction } from '@/app/actions/outfits';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface FeedbackButtonsProps {
  outfitId: string;
  initialFeedback?: LookFeedback | null;
}

export function FeedbackButtons({ outfitId, initialFeedback }: FeedbackButtonsProps) {
  const [state, action, pending] = useActionState(feedbackOutfitAction, undefined);
  const [currentValue, setCurrentValue] = useState<FeedbackValue | null>(initialFeedback?.value ?? null);
  const [currentReason, setCurrentReason] = useState<FeedbackReasonId | null>(
    (initialFeedback?.reason as FeedbackReasonId) ?? null,
  );
  const [showReasons, setShowReasons] = useState<boolean>(initialFeedback?.value === 'not_for_me');

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={action}
          onSubmit={() => {
            setCurrentValue('love_it');
            setCurrentReason(null);
            setShowReasons(false);
          }}
        >
          <input type="hidden" name="outfitId" value={outfitId} />
          <input type="hidden" name="value" value="love_it" />
          <button
            type="submit"
            disabled={pending}
            aria-label="Love this look"
            aria-pressed={currentValue === 'love_it'}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              currentValue === 'love_it'
                ? 'border-plum bg-plum text-white shadow-xs'
                : 'border-border bg-card text-foreground hover:border-plum/50 hover:bg-plum/5'
            }`}
          >
            {pending && currentValue === 'love_it' ? (
              <Spinner className="size-3.5" />
            ) : (
              <Heart
                aria-hidden
                className={`size-3.5 ${currentValue === 'love_it' ? 'fill-current text-white' : 'text-plum'}`}
              />
            )}
            <span>{currentValue === 'love_it' ? 'Loved' : 'Love it'}</span>
          </button>
        </form>

        <form
          action={action}
          onSubmit={() => {
            setCurrentValue('not_for_me');
            setShowReasons(true);
          }}
        >
          <input type="hidden" name="outfitId" value={outfitId} />
          <input type="hidden" name="value" value="not_for_me" />
          <button
            type="submit"
            disabled={pending}
            aria-label="Not for me"
            aria-pressed={currentValue === 'not_for_me'}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
              currentValue === 'not_for_me'
                ? 'border-border bg-surface-muted text-foreground font-semibold shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:border-border hover:bg-surface-muted/50 hover:text-foreground'
            }`}
          >
            {pending && currentValue === 'not_for_me' && !currentReason ? (
              <Spinner className="size-3.5" />
            ) : (
              <ThumbsDown aria-hidden className="size-3.5" />
            )}
            <span>{currentValue === 'not_for_me' ? 'Not for me' : 'Not for me'}</span>
          </button>
        </form>
      </div>

      {showReasons && (
        <div
          aria-label="Feedback reasons"
          className="space-y-2 rounded-lg border border-border/60 bg-surface-muted/30 p-3"
        >
          <p className="text-xs text-muted-foreground">What didn’t work? (Optional)</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select a reason">
            {FEEDBACK_REASONS.map((r) => {
              const selected = currentReason === r.id;
              return (
                <form
                  key={r.id}
                  action={action}
                  onSubmit={() => {
                    setCurrentReason(r.id);
                  }}
                >
                  <input type="hidden" name="outfitId" value={outfitId} />
                  <input type="hidden" name="value" value="not_for_me" />
                  <input type="hidden" name="reason" value={r.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    aria-pressed={selected}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-all ${
                      selected
                        ? 'border-plum bg-plum text-white font-medium shadow-xs'
                        : 'border-border bg-card text-foreground hover:border-border hover:bg-surface-muted'
                    }`}
                  >
                    {r.label}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      )}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.success && !state.error && (
        <p className="text-xs text-muted-foreground" role="status">
          Feedback saved · will gently guide future recommendations
        </p>
      )}
    </div>
  );
}
