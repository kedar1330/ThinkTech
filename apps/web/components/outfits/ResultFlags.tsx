import type { RecommendationResponse } from '@styleme/contracts';
import { Alert } from '@/components/ui/alert';
import { resultNotices } from '@/lib/discover/results';

/** Limited results, defaults applied and preference conflicts, in plain words (FR-LOOK-09 … 11). */
export function ResultFlags({ result }: { result: RecommendationResponse }) {
  const notices = resultNotices(result);
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <Alert key={notice.id}>{notice.text}</Alert>
      ))}
    </div>
  );
}
