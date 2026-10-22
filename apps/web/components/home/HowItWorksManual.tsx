'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Palette,
  Shirt,
  ShoppingBag,
  Camera,
  Scissors,
  MessageSquare,
  BookmarkCheck,
  Grid3X3,
  Compass,
} from 'lucide-react';
import type { ManualStep } from '@styleme/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'color-palette': Palette,
  'outfit-category': Shirt,
  'discover-look': Sparkles,
  'shop-look': ShoppingBag,
  'virtual-try-on': Camera,
  'design-studio': Scissors,
  'style-assistant': MessageSquare,
  'saved-outfits': BookmarkCheck,
};

interface HowItWorksManualProps {
  steps: ManualStep[];
}

export function HowItWorksManual({ steps }: HowItWorksManualProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'walkthrough' | 'grid'>('walkthrough');

  if (!steps || steps.length === 0) {
    return null;
  }

  const currentStep = (steps[activeStepIndex] ?? steps[0]) as ManualStep;
  const StepIcon = STEP_ICONS[currentStep.slug] ?? Sparkles;

  const handleNext = () => {
    setActiveStepIndex((prev) => (prev + 1 < steps.length ? prev + 1 : 0));
  };

  const handlePrev = () => {
    setActiveStepIndex((prev) => (prev - 1 >= 0 ? prev - 1 : steps.length - 1));
  };

  return (
    <section
      id="how-it-works-manual"
      className="space-y-8 rounded-2xl border border-border/80 bg-surface/70 p-6 sm:p-8 backdrop-blur-sm"
    >
      {/* Header section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end border-b border-border/60 pb-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-plum/10 text-plum">
              <Sparkles className="size-4 text-plum" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-plum">Interactive Website Manual</p>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-primary">How StyleMe Works: Your Complete Guide</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            From discovering your personalized color palette and exploring curated outfit categories, to discovering
            complete looks, smart shopping, virtual fitting, bespoke design studio, style assistant, and your saved
            wardrobe.
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-muted/50 p-1 self-start sm:self-auto">
          <button
            type="button"
            id="view-mode-walkthrough"
            onClick={() => setViewMode('walkthrough')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'walkthrough'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={viewMode === 'walkthrough'}
          >
            <Compass className="size-3.5" />
            Walkthrough
          </button>
          <button
            type="button"
            id="view-mode-grid"
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              viewMode === 'grid' ? 'bg-surface text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={viewMode === 'grid'}
          >
            <Grid3X3 className="size-3.5" />
            All 8 Steps
          </button>
        </div>
      </div>

      {/* Step Navigation Bar / Stepper */}
      <nav aria-label="StyleMe workflow steps" className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-none">
        <ol className="flex items-center gap-2 min-w-max">
          {steps.map((step, idx) => {
            const Icon = STEP_ICONS[step.slug] ?? Sparkles;
            const isActive = idx === activeStepIndex;
            return (
              <li key={step.slug}>
                <button
                  type="button"
                  id={`step-tab-${step.stepNumber}`}
                  onClick={() => {
                    setActiveStepIndex(idx);
                    if (viewMode === 'grid') setViewMode('walkthrough');
                  }}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all text-left',
                    isActive
                      ? 'border-plum bg-plum text-white shadow-sm ring-2 ring-plum/20'
                      : 'border-border bg-surface text-muted-foreground hover:border-plum/40 hover:text-foreground',
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors',
                      isActive
                        ? 'bg-white text-plum'
                        : 'bg-surface-muted text-muted-foreground group-hover:bg-plum/10 group-hover:text-plum',
                    )}
                  >
                    {step.stepNumber}
                  </span>
                  <Icon
                    className={cn('size-3.5', isActive ? 'text-white' : 'text-muted-foreground group-hover:text-plum')}
                  />
                  <span>{step.title.replace(/^\d+\.\s*/, '')}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Walkthrough view */}
      {viewMode === 'walkthrough' && (
        <div
          id="step-active-card"
          className="grid gap-8 lg:grid-cols-12 items-center rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-sm"
        >
          {/* Left Column: Visual Image Display */}
          <div className="lg:col-span-6 space-y-3">
            <div className="group relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border/70 bg-surface-muted shadow-inner">
              <Image
                src={currentStep.imageUrl}
                alt={currentStep.imageAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

              {/* Badges Overlay */}
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                  Step {currentStep.stepNumber} of {steps.length}
                </span>
                <span className="inline-flex items-center rounded-full bg-plum/90 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">
                  {currentStep.category}
                </span>
              </div>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90">
                <span className="font-medium drop-shadow-sm">{currentStep.tagline}</span>
                {currentStep.status === 'live' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                    Live Feature
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-600/90 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                    Preview / Studio
                  </span>
                )}
              </div>
            </div>

            {/* Stepper controls */}
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <button
                type="button"
                id="prev-step-btn"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 font-medium hover:text-plum transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Previous step
              </button>
              <span>
                {activeStepIndex + 1} / {steps.length}
              </span>
              <button
                type="button"
                id="next-step-btn"
                onClick={handleNext}
                className="inline-flex items-center gap-1 font-medium hover:text-plum transition-colors"
              >
                Next step <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Right Column: Detailed Explanations & Highlights */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-plum/10 text-plum">
                  <StepIcon className="size-4" />
                </span>
                <Badge
                  className={
                    currentStep.status === 'live'
                      ? 'border-emerald-600/40 bg-emerald-50 text-emerald-800'
                      : 'border-amber-600/40 bg-amber-50 text-amber-800'
                  }
                >
                  {currentStep.status === 'live' ? 'Available Now in StyleMe' : 'In Design / Preview'}
                </Badge>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl text-primary">{currentStep.title}</h3>
              <p className="text-sm font-medium text-plum">{currentStep.tagline}</p>
              <p className="text-sm text-muted-foreground leading-relaxed pt-1">{currentStep.description}</p>
            </div>

            {/* Key highlights bullet list */}
            <div className="space-y-2.5 rounded-xl border border-border/70 bg-surface-muted/40 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Key Capabilities</h4>
              <ul className="space-y-2 text-sm text-foreground">
                {currentStep.highlights.map((highlight, hIdx) => (
                  <li key={hIdx} className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 text-plum shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action button */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild variant="accent">
                <Link href={currentStep.actionHref} id={`action-btn-step-${currentStep.stepNumber}`}>
                  {currentStep.actionLabel}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button type="button" variant="outline" size="default" onClick={handleNext}>
                Next Feature
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Grid view showing all 8 steps */}
      {viewMode === 'grid' && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => {
            const Icon = STEP_ICONS[step.slug] ?? Sparkles;
            const isSelected = idx === activeStepIndex;
            return (
              <Card
                key={step.slug}
                className={cn(
                  'group flex flex-col justify-between overflow-hidden p-0 border transition-all duration-300 hover:shadow-md hover:border-plum/60',
                  isSelected ? 'ring-2 ring-plum border-plum' : 'border-border bg-surface',
                )}
              >
                <div className="relative aspect-16/10 w-full overflow-hidden bg-surface-muted">
                  <Image
                    src={step.imageUrl}
                    alt={step.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="flex size-6 items-center justify-center rounded-full bg-plum text-xs font-bold text-white shadow-sm">
                      {step.stepNumber}
                    </span>
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md">
                      {step.category}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2.5">
                    {step.status === 'live' ? (
                      <span className="rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Live
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                        Preview
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col justify-between flex-1 p-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-plum font-semibold">
                      <Icon className="size-3.5" />
                      <span>Step {step.stepNumber}</span>
                    </div>
                    <h3 className="font-semibold text-sm leading-snug text-primary group-hover:text-plum transition-colors line-clamp-1">
                      {step.title.replace(/^\d+\.\s*/, '')}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{step.description}</p>
                  </div>

                  <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveStepIndex(idx);
                        setViewMode('walkthrough');
                      }}
                      className="text-xs font-medium text-plum hover:underline inline-flex items-center gap-1"
                    >
                      View details <ArrowRight className="size-3" />
                    </button>
                    <Link
                      href={step.actionHref}
                      className="text-xs font-medium text-foreground hover:text-plum transition-colors"
                    >
                      Open &rarr;
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer info banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border/60 bg-surface-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Complete Styling Ecosystem:</span> The manual steps and visual
          data above are stored in and served directly from the dedicated platform database table.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/profile" className="font-medium text-plum hover:underline">
            Update Style Profile &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
