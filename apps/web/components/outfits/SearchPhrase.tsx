'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';

// A generic search phrase the user can copy and search for anywhere (FR-LOOK-15). The result of the copy
// is announced to screen readers.

const ANNOUNCEMENT = { idle: '', copied: 'Copied', failed: 'Could not copy. Select the text to copy it.' } as const;

export function SearchPhrase({ phrase }: { phrase: string }) {
  const [status, setStatus] = useState<keyof typeof ANNOUNCEMENT>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(phrase);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 break-words text-xs text-muted-foreground">
          Search for: <span className="text-foreground">{phrase}</span>
        </p>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy search phrase: ${phrase}`}
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium hover:border-plum/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <Copy aria-hidden className="size-3.5" />
          Copy
        </button>
        <span aria-live="polite" className="text-xs font-medium text-success">
          {ANNOUNCEMENT[status]}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Search for this style at a store of your choice.</p>
    </div>
  );
}
