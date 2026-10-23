import type { TailorSpec } from '@styleme/contracts';

// The tailor's specification for one design (D-134), laid out to be shown on a phone or printed.

function Steps({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null;
  const List = ordered ? 'ol' : 'ul';
  return (
    <section className="break-inside-avoid space-y-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-plum">{title}</h3>
      <List className={ordered ? 'list-decimal space-y-1 pl-5 text-sm' : 'list-disc space-y-1 pl-5 text-sm'}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </List>
    </section>
  );
}

export function TailorSheet({ spec }: { spec: TailorSpec }) {
  const rows: [string, string][] = [
    ['Garment', spec.garment],
    ['Silhouette', spec.silhouette],
    ['Neckline', spec.neckline],
    ['Sleeves', spec.sleeves],
    ['Length', spec.length],
    ['Closure', spec.closure],
  ];
  return (
    <div className="space-y-5">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="font-medium text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="break-inside-avoid space-y-1.5 rounded-xl bg-[#fbf6ec] p-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-plum">Fabric</h3>
        <p>
          <span className="font-medium">Main:</span> {spec.fabric.primary}
        </p>
        {spec.fabric.alternatives.length > 0 && (
          <p>
            <span className="font-medium">Also works:</span> {spec.fabric.alternatives.join(', ')}
          </p>
        )}
        <p>
          <span className="font-medium">Lining:</span> {spec.fabric.lining}
        </p>
        <p>
          <span className="font-medium">How much to buy (estimate):</span> {spec.yardage.estimate}
        </p>
        <p className="text-xs text-muted-foreground">
          {spec.yardage.basis} Your tailor confirms the amount after taking your measurements.
        </p>
      </section>

      <Steps title="Cutting" items={spec.cutting} ordered />
      <Steps title="Stitching" items={spec.stitching} ordered />
      <Steps title="Finishing" items={spec.finishing} />
      <Steps title="Embellishment" items={spec.embellishment} />
      <Steps title="Notes for the tailor" items={spec.tailorNotes} />
    </div>
  );
}
