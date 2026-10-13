'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { FormState } from '@/lib/actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

// Emailed links carry their token in the URL fragment (`#token=…`), which browsers never send to a
// server or in a Referer. It is read once per page load and immediately removed from the address bar.
let captured: string | null = null;

function captureFragmentToken(): string {
  if (captured === null) {
    const hash = window.location.hash;
    captured = new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
    if (hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return captured;
}

const noSubscribe = () => () => {};

/** The link token on the client; `null` during server rendering. */
export function useFragmentToken(): string | null {
  return useSyncExternalStore(noSubscribe, captureFragmentToken, () => null);
}

/**
 * Redeems an emailed link once. The link is single-use, so the call is guarded against running twice
 * (React development mode mounts effects twice). An empty token gets the server's "incomplete link".
 */
export function LinkHandler({
  action,
  workingText,
  failure,
}: {
  action: (token: string) => Promise<FormState>;
  workingText: string;
  /** Recovery options for an invalid or expired link. */
  failure: React.ReactNode;
}) {
  const token = useFragmentToken();
  const started = useRef(false);
  const [state, setState] = useState<FormState | 'working'>('working');

  useEffect(() => {
    if (token === null || started.current) return;
    started.current = true;
    action(token)
      .then((result) => setState(result ?? { success: 'Done.' }))
      // On success the server action redirects, which Next.js performs itself.
      .catch(() => setState({ error: 'We could not reach StyleMe. Check your connection and try again.' }));
  }, [action, token]);

  if (state === 'working') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner /> {workingText}
      </p>
    );
  }
  if (state?.error) {
    return (
      <div className="space-y-5">
        <Alert tone="error">{state.error}</Alert>
        {failure}
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <Alert tone="success">{state?.success}</Alert>
      <Button asChild size="full">
        <Link href="/login">Continue</Link>
      </Button>
    </div>
  );
}
