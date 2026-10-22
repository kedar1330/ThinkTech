// Colour utilities for My Colour Palette: readable text on top of any colour swatch.

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
