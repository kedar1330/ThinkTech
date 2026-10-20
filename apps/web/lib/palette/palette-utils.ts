import { COLORS, COLOR_FAMILIES, type PaletteSummary, type Swatch } from '@styleme/contracts';

// Palette utilities for My Colour Palette (FR-PAL-01 … 03).

const FAMILY_LABEL_MAP = new Map(COLOR_FAMILIES.map((f) => [f.id, f.label]));
const COLOR_TO_FAMILY_MAP = new Map(COLORS.map((c) => [c.id, c.family]));

/**
 * Returns the human-readable colour family label for a given swatch (e.g. 'Blue', 'Neutral').
 */
export function getSwatchFamily(swatch: Swatch): string | undefined {
  const familyId = COLOR_TO_FAMILY_MAP.get(swatch.colorId);
  return familyId ? (FAMILY_LABEL_MAP.get(familyId) ?? familyId) : undefined;
}

/**
 * Derives unique, human-readable colour family labels represented in a palette.
 */
export function paletteFamilies(palette: PaletteSummary): string[] {
  const swatches = [...palette.neutrals, ...palette.accents];
  const families = new Set<string>();
  for (const s of swatches) {
    const f = getSwatchFamily(s);
    if (f) families.add(f);
  }
  return Array.from(families);
}

/**
 * Calculates WCAG 2 relative luminance for a 6-digit hex colour string.
 */
export function relativeLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '');
  const channel = (i: number) => {
    const c = parseInt(cleanHex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * Returns accessible text colour ('#1A1A1A' for light backgrounds, '#FFFFFF' for dark backgrounds)
 * ensuring WCAG AA contrast against the swatch background.
 */
export function textContrastColor(hex: string): '#1A1A1A' | '#FFFFFF' {
  const lum = relativeLuminance(hex);
  return lum > 0.179 ? '#1A1A1A' : '#FFFFFF';
}

/**
 * Formats a contrast level ('low' | 'medium' | 'high') into a readable label.
 */
export function contrastLevelLabel(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'low':
      return 'Low contrast';
    case 'medium':
      return 'Medium contrast';
    case 'high':
      return 'High contrast';
  }
}
