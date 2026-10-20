// Dashboard sections. Only "Discover My Style" and "Saved Outfits" exist today; everything else is
// labelled "Coming soon" and opens an honest description page, never a mock of the feature.

export type FeatureIcon = 'sparkles' | 'palette' | 'shirt' | 'bag' | 'camera' | 'ruler' | 'chat' | 'heart';

export interface Feature {
  slug: string;
  label: string;
  icon: FeatureIcon;
  /** Where the feature lives when available; undefined means "Coming soon". */
  href?: string;
  summary: string;
}

export const FEATURES: Feature[] = [
  {
    slug: 'discover-my-style',
    label: 'Discover My Style',
    icon: 'sparkles',
    // The occasion → looks form until the FR-DMS catalogue page (TD-FS-DMS-01) replaces it.
    href: '/discover/looks',
    summary: 'Your style profile and optional appearance signals — sizes, fit, colours, coverage and more.',
  },
  {
    slug: 'colour-palette',
    label: 'My Colour Palette',
    icon: 'palette',
    summary: 'Colour palettes shaped by the colours you love and avoid, and your optional appearance signals.',
  },
  {
    slug: 'outfit-categories',
    label: 'Outfit Categories',
    icon: 'shirt',
    summary: 'Browse looks by occasion and category — Indian, fusion and western — each with a reason it suits you.',
  },
  {
    slug: 'shop-my-look',
    label: 'Shop My Look',
    icon: 'bag',
    href: '/shop',
    summary: 'Save items you find in any store, with their prices, and compare the total with your budget per look.',
  },
  {
    slug: 'virtual-try-on',
    label: 'Virtual Try-On',
    icon: 'camera',
    summary: 'Preview how a look could come together before you buy.',
  },
  {
    slug: 'design-studio',
    label: 'Design Studio',
    icon: 'ruler',
    summary: 'Sketch and refine custom pieces to take to your tailor.',
  },
  {
    slug: 'style-assistant',
    label: 'Style Assistant',
    icon: 'chat',
    summary: 'Ask styling questions in plain language and get answers grounded in your profile.',
  },
  {
    slug: 'saved-outfits',
    label: 'Saved Outfits',
    icon: 'heart',
    href: '/saved',
    summary: 'Keep the looks you love in one place.',
  },
];

export function featureHref(f: Feature): string {
  return f.href ?? `/features/${f.slug}`;
}

export function findFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
