import { Alert } from '@/components/ui/alert';

/** Text page (About, legal). `draft` shows the pending-legal-review notice (D-74). */
export function ProsePage({
  eyebrow,
  title,
  updated,
  draft,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  draft?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">{eyebrow}</p>
        <h1 className="font-display text-4xl text-primary sm:text-5xl">{title}</h1>
        {updated && <p className="text-sm text-muted-foreground">Version {updated}</p>}
      </header>
      {draft && (
        <Alert tone="info">
          This is a draft pending legal review. It describes how StyleMe works today and will be finalised before public
          launch.
        </Alert>
      )}
      <div className="space-y-5 text-[15px] leading-relaxed text-foreground/90 [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-primary [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
}
