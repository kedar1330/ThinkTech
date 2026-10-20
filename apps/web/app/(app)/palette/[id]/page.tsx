import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { PaletteListResponse } from '@styleme/contracts';
import { PaletteDetail } from '@/components/palette/PaletteDetail';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { accessToken } = await requireOnboarded();
  const { id } = await params;
  const { palettes } = await apiRequest<PaletteListResponse>('/v1/style/palettes?view=all', {
    token: accessToken,
  }).catch(() => ({ palettes: [] }));
  const palette = palettes.find((p) => p.id === id);
  return { title: palette ? `${palette.name} · Palette` : 'Colour palette' };
}

/**
 * Palette detail page (FR-PAL-01 … 03).
 * Shows large swatches, colour names, hex codes, combinations with contrast labels, and coordinating colours.
 */
export default async function PaletteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { accessToken } = await requireOnboarded();
  const { id } = await params;
  const { palettes } = await apiRequest<PaletteListResponse>('/v1/style/palettes?view=all', {
    token: accessToken,
  });
  const palette = palettes.find((p) => p.id === id);
  if (!palette) notFound();

  return <PaletteDetail palette={palette} />;
}
