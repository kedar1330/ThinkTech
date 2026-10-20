/**
 * The engine's explanation for a look, shown exactly as returned (AC-11, FR-LOOK-12). Optional AI wording
 * (#55) would also come from the API, so this stays the same.
 */
export function WhyThisWorks({ explanation }: { explanation: string }) {
  return (
    <details open className="group rounded-lg border border-border bg-background/50 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        Why this works
      </summary>
      <p className="mt-2 text-sm">{explanation}</p>
    </details>
  );
}
