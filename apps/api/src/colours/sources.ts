import type { ColourSource } from '@styleme/contracts';
import { findJudgementalLanguage } from '../style-rules/inclusive-language';
import xkcd from './data/xkcd-colours.json' with { type: 'json' };

// The colour library's raw material: openly licensed colour names and hex values only (D-133). Proprietary
// colour systems (Pantone, RAL, brand colour cards) are never used. Every name passes a filter: names that
// judge, describe bodily substances, imply one "skin" or "nude" colour, or name a brand are left out.

export interface SourceColour {
  name: string;
  hex: string;
  source: ColourSource;
}

export const COLOUR_SOURCE_NOTES: Record<ColourSource, { title: string; licence: string; url: string }> = {
  css: {
    title: 'CSS Color Module Level 4 named colours (W3C)',
    licence: 'W3C Software and Document Licence; colour keywords are a public web standard',
    url: 'https://www.w3.org/TR/css-color-4/#named-colors',
  },
  xkcd: { title: xkcd.source, licence: xkcd.licence, url: 'https://xkcd.com/color/rgb.txt' },
};

/** CSS named colours, with readable names. `grey` spellings only; `aqua`/`fuchsia` duplicates removed. */
const CSS_NAMED: ReadonlyArray<readonly [string, string]> = [
  ['Alice Blue', '#F0F8FF'],
  ['Antique White', '#FAEBD7'],
  ['Aquamarine', '#7FFFD4'],
  ['Azure', '#F0FFFF'],
  ['Beige', '#F5F5DC'],
  ['Bisque', '#FFE4C4'],
  ['Black', '#000000'],
  ['Blanched Almond', '#FFEBCD'],
  ['Blue', '#0000FF'],
  ['Blue Violet', '#8A2BE2'],
  ['Brown', '#A52A2A'],
  ['Burlywood', '#DEB887'],
  ['Cadet Blue', '#5F9EA0'],
  ['Chartreuse', '#7FFF00'],
  ['Chocolate', '#D2691E'],
  ['Coral', '#FF7F50'],
  ['Cornflower Blue', '#6495ED'],
  ['Cornsilk', '#FFF8DC'],
  ['Crimson', '#DC143C'],
  ['Cyan', '#00FFFF'],
  ['Dark Blue', '#00008B'],
  ['Dark Cyan', '#008B8B'],
  ['Dark Goldenrod', '#B8860B'],
  ['Dark Grey', '#A9A9A9'],
  ['Dark Green', '#006400'],
  ['Dark Khaki', '#BDB76B'],
  ['Dark Magenta', '#8B008B'],
  ['Dark Olive Green', '#556B2F'],
  ['Dark Orange', '#FF8C00'],
  ['Dark Orchid', '#9932CC'],
  ['Dark Red', '#8B0000'],
  ['Dark Salmon', '#E9967A'],
  ['Dark Sea Green', '#8FBC8F'],
  ['Dark Slate Blue', '#483D8B'],
  ['Dark Slate Grey', '#2F4F4F'],
  ['Dark Turquoise', '#00CED1'],
  ['Dark Violet', '#9400D3'],
  ['Deep Pink', '#FF1493'],
  ['Deep Sky Blue', '#00BFFF'],
  ['Dim Grey', '#696969'],
  ['Dodger Blue', '#1E90FF'],
  ['Firebrick', '#B22222'],
  ['Floral White', '#FFFAF0'],
  ['Forest Green', '#228B22'],
  ['Gainsboro', '#DCDCDC'],
  ['Ghost White', '#F8F8FF'],
  ['Gold', '#FFD700'],
  ['Goldenrod', '#DAA520'],
  ['Grey', '#808080'],
  ['Green', '#008000'],
  ['Green Yellow', '#ADFF2F'],
  ['Honeydew', '#F0FFF0'],
  ['Hot Pink', '#FF69B4'],
  ['Indian Red', '#CD5C5C'],
  ['Indigo', '#4B0082'],
  ['Ivory', '#FFFFF0'],
  ['Khaki', '#F0E68C'],
  ['Lavender', '#E6E6FA'],
  ['Lavender Blush', '#FFF0F5'],
  ['Lawn Green', '#7CFC00'],
  ['Lemon Chiffon', '#FFFACD'],
  ['Light Blue', '#ADD8E6'],
  ['Light Coral', '#F08080'],
  ['Light Cyan', '#E0FFFF'],
  ['Light Goldenrod Yellow', '#FAFAD2'],
  ['Light Grey', '#D3D3D3'],
  ['Light Green', '#90EE90'],
  ['Light Pink', '#FFB6C1'],
  ['Light Salmon', '#FFA07A'],
  ['Light Sea Green', '#20B2AA'],
  ['Light Sky Blue', '#87CEFA'],
  ['Light Slate Grey', '#778899'],
  ['Light Steel Blue', '#B0C4DE'],
  ['Light Yellow', '#FFFFE0'],
  ['Lime', '#00FF00'],
  ['Lime Green', '#32CD32'],
  ['Linen', '#FAF0E6'],
  ['Magenta', '#FF00FF'],
  ['Maroon', '#800000'],
  ['Medium Aquamarine', '#66CDAA'],
  ['Medium Blue', '#0000CD'],
  ['Medium Orchid', '#BA55D3'],
  ['Medium Purple', '#9370DB'],
  ['Medium Sea Green', '#3CB371'],
  ['Medium Slate Blue', '#7B68EE'],
  ['Medium Spring Green', '#00FA9A'],
  ['Medium Turquoise', '#48D1CC'],
  ['Medium Violet Red', '#C71585'],
  ['Midnight Blue', '#191970'],
  ['Mint Cream', '#F5FFFA'],
  ['Misty Rose', '#FFE4E1'],
  ['Moccasin', '#FFE4B5'],
  ['Navajo White', '#FFDEAD'],
  ['Navy', '#000080'],
  ['Old Lace', '#FDF5E6'],
  ['Olive', '#808000'],
  ['Olive Drab', '#6B8E23'],
  ['Orange', '#FFA500'],
  ['Orange Red', '#FF4500'],
  ['Orchid', '#DA70D6'],
  ['Pale Goldenrod', '#EEE8AA'],
  ['Pale Green', '#98FB98'],
  ['Pale Turquoise', '#AFEEEE'],
  ['Pale Violet Red', '#DB7093'],
  ['Papaya Whip', '#FFEFD5'],
  ['Peach Puff', '#FFDAB9'],
  ['Peru', '#CD853F'],
  ['Pink', '#FFC0CB'],
  ['Plum', '#DDA0DD'],
  ['Powder Blue', '#B0E0E6'],
  ['Purple', '#800080'],
  ['Rebecca Purple', '#663399'],
  ['Red', '#FF0000'],
  ['Rosy Brown', '#BC8F8F'],
  ['Royal Blue', '#4169E1'],
  ['Saddle Brown', '#8B4513'],
  ['Salmon', '#FA8072'],
  ['Sandy Brown', '#F4A460'],
  ['Sea Green', '#2E8B57'],
  ['Seashell', '#FFF5EE'],
  ['Sienna', '#A0522D'],
  ['Silver', '#C0C0C0'],
  ['Sky Blue', '#87CEEB'],
  ['Slate Blue', '#6A5ACD'],
  ['Slate Grey', '#708090'],
  ['Snow', '#FFFAFA'],
  ['Spring Green', '#00FF7F'],
  ['Steel Blue', '#4682B4'],
  ['Tan', '#D2B48C'],
  ['Teal', '#008080'],
  ['Thistle', '#D8BFD8'],
  ['Tomato', '#FF6347'],
  ['Turquoise', '#40E0D0'],
  ['Violet', '#EE82EE'],
  ['Wheat', '#F5DEB3'],
  ['White', '#FFFFFF'],
  ['White Smoke', '#F5F5F5'],
  ['Yellow', '#FFFF00'],
  ['Yellow Green', '#9ACD32'],
];

/**
 * Words that keep a name out of the library: judgemental or unpleasant words, bodily substances, names that
 * present one skin colour as the default ("flesh", "nude", "skin"), and trademarks.
 */
const EXCLUDED_WORDS = [
  'ugly',
  'dirty',
  'nasty',
  'sick',
  'sickly',
  'puke',
  'vomit',
  'barf',
  'poo',
  'poop',
  'shit',
  'piss',
  'pee',
  'snot',
  'booger',
  'diarrhea',
  'bile',
  'mud',
  'muddy',
  'murky',
  'swamp',
  'sewage',
  'dull',
  'drab',
  'flesh',
  'fleshy',
  'nude',
  'skin',
  'barney',
  'kermit',
  'windows',
  'toxic',
  'radioactive',
  'gross',
  'bland',
  'boring',
  'blood',
  'bloody',
  'pig',
  'dirt',
  'camo',
  'nicotine',
  'bruise',
  'sludge',
  'reddy',
];

const HUE_WORDS = 'blue|green|grey|yellow|orange|red|purple|pink|brown';

/** Spelling slips in the survey names. */
const SPELLING: Record<string, string> = {
  liliac: 'lilac',
  terracota: 'terracotta',
  siena: 'sienna',
  camoflauge: 'camo',
  manilla: 'manila',
};

/** Title Case, keeping short joining words lower case ("Robin's Egg" style apostrophes kept). */
function titleCase(name: string): string {
  return name
    .split(/\s+/)
    .map((w, i) => (i > 0 && ['of', 'and', 'the'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function isAllowedColourName(name: string): boolean {
  const words = name.toLowerCase().split(/[\s/'-]+/);
  if (words.some((w) => EXCLUDED_WORDS.includes(w))) return false;
  if (new Set(words).size < words.length) return false; // "light light green"
  // "greenish", "pinky", "browny": vague in-between names, not useful in a library.
  if (words.some((w) => w.endsWith('ish') || /^(?:pink|purpl|green|brown|yellow|orang|blu|red)e?y$/.test(w)))
    return false;
  return findJudgementalLanguage(name).length === 0;
}

/** Every allowed source colour, CSS first (so a CSS name wins when two colours are the same). */
export function sourceColours(): SourceColour[] {
  const out: SourceColour[] = CSS_NAMED.map(([name, hex]) => ({ name, hex, source: 'css' as const }));
  for (const [name, hex] of xkcd.colours as Array<[string, string]>) {
    // "darkblue" → "dark blue", "bluegrey" → "blue grey"; names with a slash ("blue/green") are left out.
    const readable = name
      .replace(/\bgray\b/g, 'grey')
      .replace(/^(dark|light|pale|deep)(?=[a-z]{3,}$)/, '$1 ')
      .replace(new RegExp(`^(${HUE_WORDS})(?=(?:${HUE_WORDS})$)`), '$1 ')
      .replace(/\b(liliac|terracota|siena|camoflauge|manilla)\b/, (w) => SPELLING[w] ?? w);
    if (readable.includes('/') || !isAllowedColourName(readable)) continue;
    out.push({ name: titleCase(readable), hex: hex.toUpperCase(), source: 'xkcd' });
  }
  return out;
}
