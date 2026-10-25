'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[Application Error Caught]', error);
  }, [error]);

  const isServiceUnavailable =
    error.message?.includes('temporarily unavailable') ||
    error.message?.includes('SERVICE_UNAVAILABLE') ||
    error.message?.includes('fetch failed');

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
          <AlertTriangle className="size-7" />
        </span>

        <h2 className="font-display text-2xl font-bold text-foreground">
          {isServiceUnavailable ? 'Service Temporarily Unavailable' : 'Something Went Wrong'}
        </h2>

        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
          {isServiceUnavailable
            ? 'StyleMe is currently establishing a connection with the database. Please give it a few seconds and try again.'
            : error.message || 'An unexpected error occurred while loading this page.'}
        </p>

        {process.env.NODE_ENV === 'development' && isServiceUnavailable && (
          <div className="mt-4 rounded-lg bg-surface-muted p-2.5 text-left font-mono text-[11px] text-muted-foreground border border-border">
            <span className="font-semibold text-foreground">Dev Note:</span> Ensure the backend API is active on port
            4000:
            <code className="block mt-1 text-plum">pnpm dev:api</code>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => reset()} className="gap-2 bg-plum hover:bg-plum/90 text-white">
            <RefreshCw className="size-4" />
            Try Again
          </Button>

          <Button asChild variant="outline">
            <Link href="/home" className="gap-2">
              <Home className="size-4" />
              Go to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
