import type { ClothingStyleItem } from '@styleme/contracts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sparkles, Check, HelpCircle } from 'lucide-react';

export function StyleCard({ style }: { style: ClothingStyleItem }) {
  const headingId = `style-title-${style.styleId}`;

  return (
    <Card className="flex h-full flex-col justify-between p-5 hover:border-plum/40 hover:shadow-md transition-all">
      <article aria-labelledby={headingId} className="space-y-4">
        <header className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-plum">
              {style.department} · {style.wearTypes?.join(', ') ?? 'clothing'}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">{style.styleId}</span>
          </div>
          <h3 id={headingId} className="font-display text-2xl text-primary">
            {style.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{style.description}</p>
        </header>

        {/* Defining Attribute & Key Attributes */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {style.definingAttribute && (
            <Badge className="border-plum/30 bg-plum/10 text-plum font-medium">
              {style.definingAttribute.attributeId.replace('_', ' ')}:{' '}
              {style.definingAttribute.valueId.replace('_', ' ')}
            </Badge>
          )}
          {style.attributes?.map((attr) => (
            <Badge
              key={`${attr.attributeId}-${attr.valueId}`}
              className="border-border bg-surface text-foreground font-normal"
            >
              {attr.valueId.replace('_', ' ')}
            </Badge>
          ))}
        </div>

        {/* Why this suits you / Explanation */}
        {style.explanation && (
          <div className="rounded-lg bg-surface-raised p-3.5 border border-border/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-plum">
              <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Why it suits you</span>
            </div>
            <p className="text-xs text-foreground leading-relaxed">{style.explanation.summary}</p>
            {style.explanation.benefits && style.explanation.benefits.length > 0 && (
              <ul className="space-y-1 pt-1 text-[11px] text-muted-foreground">
                {style.explanation.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="size-3 text-plum shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Body Shapes & Styling Goals */}
        <div className="space-y-2 pt-1 border-t border-border/60">
          {style.bodyShapes && style.bodyShapes.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Suits body shapes</p>
              <div className="flex flex-wrap gap-1">
                {style.bodyShapes.map((shape) => (
                  <span
                    key={shape}
                    className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-primary capitalize"
                  >
                    {shape.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {style.stylingGoals && style.stylingGoals.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground">Styling goals</p>
              <div className="flex flex-wrap gap-1">
                {style.stylingGoals.map((goal) => (
                  <span
                    key={goal}
                    className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {goal.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>

      {/* Styling Tips Footer */}
      {style.explanation?.stylingTips && style.explanation.stylingTips.length > 0 && (
        <footer className="pt-3 border-t border-border mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <HelpCircle className="size-3 shrink-0 text-plum" aria-hidden="true" />
          <span className="line-clamp-1">{style.explanation.stylingTips[0]}</span>
        </footer>
      )}
    </Card>
  );
}
