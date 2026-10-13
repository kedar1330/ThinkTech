import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { findFeature } from '@/lib/features';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const feature = findFeature((await params).slug);
  return { title: feature?.label ?? 'Feature' };
}

/** "Coming soon" description for a feature that isn't available yet — no mock-ups of the feature. */
export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const feature = findFeature((await params).slug);
  if (!feature) notFound();
  if (feature.href) redirect(feature.href);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Badge>Coming soon</Badge>
      <h1 className="font-display text-4xl text-primary">{feature.label}</h1>
      <Card className="flex gap-4">
        <Hourglass aria-hidden className="mt-1 size-6 shrink-0 text-accent" />
        <div className="space-y-2">
          <p>{feature.summary}</p>
          <p className="text-sm text-muted-foreground">
            This feature is not available yet. Keeping your style profile up to date means it will be ready for you when
            it launches.
          </p>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/profile">Update my style profile</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}
