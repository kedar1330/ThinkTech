import { Alert } from '@/components/ui/alert';

/** What changed in the profile since the original look was made (#49), shown above the new looks. */
export function WhatChanged({ changes }: { changes: readonly string[] }) {
  return (
    <Alert>
      <p className="font-medium">What changed</p>
      {changes.length === 0 ? (
        <p>Nothing in your profile has changed since the original look, so these looks use the same inputs.</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-4">
          {changes.map((change) => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
