import type { Metadata } from 'next';
import {
  garmentTypeIdSchema,
  type AppearanceResponse,
  type ColourPreferencesResponse,
  type DesignFeaturesResponse,
  type DesignPreferencesResponse,
  type DesignSelectionItem,
  type ProfileResponse,
} from '@styleme/contracts';
import { PaletteColours } from '@/components/discover/PaletteColours';
import { ProfileSummary } from '@/components/discover/ProfileSummary';
import { RequestForm } from '@/components/discover/RequestForm';
import { apiRequest } from '@/lib/api/server';
import { requireOnboarded } from '@/lib/auth/session';
import { designSummary, savedDesigns } from '@/lib/discover/design-summary';

export const metadata: Metadata = { title: 'Discover My Style' };

export default async function DiscoverLooksPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; garment?: string }>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const { accessToken } = await requireOnboarded();
  const garment = params.from === 'design' ? garmentTypeIdSchema.safeParse(params.garment) : null;
  // What the user chose elsewhere: designs saved in Outfit Categories, colours from My Colour Palette and the
  // appearance signals from My Profile (D-129). Each section loads on its own, so one failure never blocks the page.
  const [profile, appearance, selections, designPreferences, colours, designData] = await Promise.all([
    apiRequest<ProfileResponse>('/v1/profile', { token: accessToken }),
    apiRequest<AppearanceResponse>('/v1/appearance', { token: accessToken }).catch(() => null),
    apiRequest<DesignSelectionItem[]>('/v1/design/selections', { token: accessToken }).catch(() => []),
    apiRequest<DesignPreferencesResponse>('/v1/design/preferences', { token: accessToken }).catch(() => null),
    apiRequest<ColourPreferencesResponse>('/v1/colours/preferences', { token: accessToken }).catch(() => null),
    // The design comes from the user's own saved selection, never from the link.
    garment?.success
      ? apiRequest<DesignFeaturesResponse>(`/v1/design/features?garmentType=${garment.data}&view=all`, {
          token: accessToken,
        }).catch(() => null)
      : null,
  ]);
  const opened = designData ? designSummary(designData) : null;
  const userDesigns = savedDesigns(selections, opened);
  const starterDesigns: typeof userDesigns = [
    {
      garmentType: 'kurta',
      garmentName: 'Classic Kurta',
      outfitCategory: 'indian',
      outfitLabel: 'Indian Wear',
      features: ['V-neck', 'Three-quarter sleeve'],
      layers: [
        { assetId: 'base', url: '/illustrations/design/women-base.svg', alt: 'Women base figure' },
        { assetId: 'v', url: '/illustrations/design/women-layer-neckline-v_neck.svg', alt: 'V-neckline' },
        { assetId: 's', url: '/illustrations/design/women-layer-sleeve-three_quarter.svg', alt: 'Three-quarter sleeve' },
      ],
      occasionFeature: 'occasion_casual',
    },
  ];
  const designs = userDesigns.length > 0 ? userDesigns : starterDesigns;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-plum">Discover My Style</p>
        <h1 className="font-display text-4xl text-primary">Find looks for your design</h1>
        <p className="text-sm text-muted-foreground">
          Looks are built around a garment you designed in Outfit Categories, with its occasion and wear type, in
          colours from My Colour Palette. Your profile is applied automatically.
        </p>
      </header>
      <ProfileSummary profile={profile} appearance={appearance} />
      <PaletteColours colours={colours} />
      <RequestForm
        sizes={profile.sizes}
        designs={designs}
        initialDesign={opened?.garmentType ?? designs[0]?.garmentType ?? null}
        occasionPreferences={designPreferences?.occasionPreferences ?? []}
      />
    </div>
  );
}
