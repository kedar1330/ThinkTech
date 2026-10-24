import {
  CATEGORIES,
  CATEGORY_GROUPS,
  COLORS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  OCCASIONS,
  PATTERNS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  STYLES,
  type Category,
  type CategoryGroup,
  type ColorId,
  type LookSpec,
  type ProfileSizes,
  type Swatch,
} from '@styleme/contracts';

// User-facing text built only from the look specification and vocabulary labels: search phrases
// (FR-LOOK-15), size notes (FR-SIZE-04) and swatches. Nothing here names a product, retailer, price
// or availability.

type Labelled = readonly { readonly id: string; readonly label: string }[];
export const label = (list: Labelled, id: string) => list.find((item) => item.id === id)?.label ?? id;
const lower = (list: Labelled, id: string) => label(list, id).toLowerCase();

export const colorLabel = (id: string) => label(COLORS, id);
export const fabricLabel = (id: string) => label(FABRICS, id);
export const silhouetteLabel = (id: string) => label(SILHOUETTES, id);
export const fitLabel = (id: string) => label(FITS, id);
export const styleLabel = (id: string) => label(STYLES, id);
export const occasionLabel = (id: string) => label(OCCASIONS, id);

export function categoryGroup(category: Category): CategoryGroup {
  return CATEGORIES.find((c) => c.id === category)!.group;
}

export function swatch(colorId: ColorId): Swatch {
  const color = COLORS.find((c) => c.id === colorId)!;
  return { colorId, name: color.label, hex: color.hex };
}

const NECKLINE_PHRASES: Record<string, string> = {
  round: 'round neck',
  v_neck: 'v-neck',
  collared: 'collared',
  mandarin: 'mandarin collar',
  boat: 'boat neck',
  square: 'square neck',
  sweetheart: 'sweetheart neck',
  high_neck: 'high neck',
};

function sleevePhrase(id: string): string {
  const text = lower(SLEEVE_LENGTHS, id);
  return id === 'sleeveless' || text.includes('sleeve') ? text : `${text} sleeve`;
}

/** A generic, copyable phrase such as "navy cotton straight regular-fit kurta" (FR-LOOK-15). */
export function searchPhrase(spec: LookSpec): string {
  const words = [
    lower(COLORS, spec.colorId),
    spec.pattern && spec.pattern !== 'solid' ? lower(PATTERNS, spec.pattern) : null,
    spec.fabric ? lower(FABRICS, spec.fabric) : null,
    spec.silhouette ? lower(SILHOUETTES, spec.silhouette) : null,
    spec.fit ? `${lower(FITS, spec.fit)}-fit` : null,
    spec.sleeve ? sleevePhrase(spec.sleeve) : null,
    spec.neckline ? NECKLINE_PHRASES[spec.neckline] : null,
    spec.length ? lower(GARMENT_LENGTHS, spec.length) : null,
    lower(CATEGORIES, spec.category),
  ];
  return words.filter(Boolean).join(' ');
}

/** "Your saved size: M", or a prompt to add one; free-size categories say so (FR-SIZE-04). */
export function sizeNote(
  category: Category,
  sizes: ProfileSizes,
  measurements?: { valuesCm?: Record<string, number> } | null,
): string {
  const group = categoryGroup(category);
  const prompt = `Add your ${lower(CATEGORY_GROUPS, group)} size in your profile`;
  const hasMeasurements = Boolean(measurements?.valuesCm && Object.keys(measurements.valuesCm).length > 0);
  switch (group) {
    case 'freeSize':
      return 'Free size';
    case 'tops':
      if (sizes.tops)
        return `Your saved size: ${sizes.tops.letter}${sizes.tops.collarIn ? `, collar ${sizes.tops.collarIn} in` : ''}`;
      if (hasMeasurements) return 'Tailored to your measurements';
      return prompt;
    case 'bottoms':
      if (sizes.bottoms)
        return `Your saved waist: ${sizes.bottoms.waistIn} in${sizes.bottoms.lengthIn ? `, length ${sizes.bottoms.lengthIn} in` : ''}`;
      if (hasMeasurements) return 'Tailored to your measurements';
      return prompt;
    case 'ethnicTops': {
      const s = sizes.ethnicTops;
      if (s) return `Your saved size: ${s.letter ?? `${s.numeric} in`}`;
      if (hasMeasurements) return 'Tailored to your measurements';
      return prompt;
    }
    case 'ethnicSets': {
      const s = sizes.ethnicSets;
      if (s) return `Your saved size: ${s.letter ?? `waist ${s.waistIn} in`}`;
      if (hasMeasurements) return 'Tailored to your measurements';
      return prompt;
    }
    case 'shoes':
      return sizes.shoes ? `Your saved size: UK ${sizes.shoes.uk}` : prompt;
    default:
      if (hasMeasurements) return 'Tailored to your measurements';
      return prompt;
  }
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}
