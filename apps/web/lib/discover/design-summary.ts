import {
  OCCASIONS,
  OUTFIT_CATEGORIES,
  WEAR_TYPES,
  type DesignFeaturesResponse,
  type DesignImage,
  type DesignSelectionItem,
  type Occasion,
  type OutfitCategory,
} from '@styleme/contracts';

// Discover My Style builds its request from Outfit Categories (D-132): the user's saved design for one garment,
// with the names of the chosen features, the customizer layers (base figure, neckline, sleeve) and the
// occasion tag chosen with it. Occasion and wear type come from the design; there is no separate form.

export interface DesignSummary {
  garmentType: string;
  garmentName: string;
  outfitCategory: OutfitCategory;
  outfitLabel: string;
  features: string[];
  /** Back to front: the base figure, then the neckline and sleeve layers. */
  layers: DesignImage[];
  /** The occasion tag chosen with the design (`occasion_festive`), if any. */
  occasionFeature: string | null;
}

/** Outfit Categories occasion tags → look occasions. Tags with no look occasion are left out. */
const OCCASION_FROM_FEATURE: Record<string, Occasion> = {
  occasion_casual: 'everyday',
  occasion_office: 'work',
  occasion_party: 'party',
  occasion_wedding: 'wedding',
  occasion_festive: 'festive',
  occasion_travel: 'travel',
};

/** Used when neither the design nor the occasion preferences name an occasion. */
export const DEFAULT_OCCASION: Occasion = 'everyday';

export interface DesignRequest {
  occasion: Occasion;
  occasionLabel: string;
  /** Where the occasion came from: the design's tag, the occasion preferences, or the default. */
  occasionSource: 'design' | 'preference' | 'default';
  wearType: OutfitCategory;
  wearTypeLabel: string;
}

/** The look request a design stands for: its occasion (tag → preferences → default) and its wear type. */
export function requestFromDesign(design: DesignSummary, occasionPreferences: readonly string[] = []): DesignRequest {
  const fromDesign = design.occasionFeature ? OCCASION_FROM_FEATURE[design.occasionFeature] : undefined;
  const fromPreference = occasionPreferences.map((id) => OCCASION_FROM_FEATURE[id]).find(Boolean);
  const occasion = fromDesign ?? fromPreference ?? DEFAULT_OCCASION;
  return {
    occasion,
    occasionLabel: OCCASIONS.find((o) => o.id === occasion)!.label,
    occasionSource: fromDesign ? 'design' : fromPreference ? 'preference' : 'default',
    wearType: design.outfitCategory,
    wearTypeLabel: WEAR_TYPES.find((w) => w.id === design.outfitCategory)?.label ?? design.outfitLabel,
  };
}

const outfitLabel = (id: OutfitCategory) => OUTFIT_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** A saved design from `GET /v1/design/selections`, without drawings; null when it has no named feature. */
export function designFromSelection(item: DesignSelectionItem): DesignSummary | null {
  const features = (item.features ?? []).map((f) => f.name);
  if (features.length === 0) return null;
  return {
    garmentType: item.garmentType,
    garmentName: item.garmentName ?? item.garmentType,
    outfitCategory: item.outfitCategory,
    outfitLabel: outfitLabel(item.outfitCategory),
    features,
    layers: [],
    occasionFeature: item.selectedFeatures.occasion ?? null,
  };
}

/**
 * The user's saved designs, newest first. The one opened from the visual customizer (`opened`, with its
 * drawings) replaces its plain entry, or is added first if the list doesn't have it.
 */
export function savedDesigns(items: readonly DesignSelectionItem[], opened: DesignSummary | null): DesignSummary[] {
  const designs = items.map(designFromSelection).filter((d): d is DesignSummary => d !== null);
  if (!opened) return designs;
  const at = designs.findIndex((d) => d.garmentType === opened.garmentType);
  return at === -1 ? [opened, ...designs] : designs.map((d, i) => (i === at ? opened : d));
}

/** Null when the user has no saved design with at least one feature for this garment. */
export function designSummary(data: DesignFeaturesResponse): DesignSummary | null {
  const selection = data.selection;
  if (!selection) return null;
  const chosen = new Set(Object.values(selection.selectedFeatures).filter(Boolean));
  if (chosen.size === 0) return null;
  const features = data.categories.flatMap((c) => c.features).filter((f) => chosen.has(f.featureId));
  const layerOf = (category: string) => features.find((f) => f.category === category)?.layer ?? null;
  return {
    garmentType: data.garmentType.id,
    garmentName: data.garmentType.name,
    outfitCategory: selection.outfitCategory,
    outfitLabel: outfitLabel(selection.outfitCategory),
    features: features.map((f) => f.name),
    layers: [data.baseFigure, layerOf('neckline'), layerOf('sleeve')].filter((l): l is DesignImage => l !== null),
    occasionFeature: selection.selectedFeatures.occasion ?? null,
  };
}
