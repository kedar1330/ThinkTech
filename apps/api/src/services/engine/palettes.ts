import type { PaletteSummary } from '@styleme/contracts';
import type { Palette } from '../../style-rules/schemas';
import type { Preferences } from './preferences';
import { swatch } from './text';

// Palette ranking for `GET /v1/style/palettes` (FR-PAL-01 … 03, AI.md §10.2). Pure and deterministic.
// `view=all` lists every approved palette by ID with nothing hidden. `view=suggested` leaves out
// palettes that contain a disliked colour and orders the rest: skin tone and undertone suitability
// first (enabled signals only), then liked colours, contrast and occasions. Nothing is removed for
// a mismatched undertone, so a palette with a liked colour is never excluded by a suggestion (FR-PAL-03).

/** Ranking factors in order; also the names returned in `suggestedBecause`. */
const FACTORS = ['undertone', 'skinTone', 'likedColors', 'contrastPreference', 'preferredOccasions'] as const;
type Factor = (typeof FACTORS)[number];

function factors(palette: Palette, prefs: Preferences): Record<Factor, number> {
  const colours = [...palette.neutrals, ...palette.accents];
  let skinTone = 0;
  if (prefs.monkRange && palette.skinToneRange) {
    const [from, to] = palette.skinToneRange.split('-').map(Number) as [number, number];
    skinTone = from <= prefs.monkRange[1] && prefs.monkRange[0] <= to ? 1 : 0;
  }
  return {
    undertone: prefs.undertone && palette.undertoneAffinity.includes(prefs.undertone) ? 1 : 0,
    skinTone,
    likedColors: colours.filter((c) => prefs.liked.has(c)).length,
    contrastPreference: prefs.contrast && palette.combinations.some((c) => c.contrastLevel === prefs.contrast) ? 1 : 0,
    preferredOccasions: palette.occasions.filter((o) => prefs.occasions.has(o)).length,
  };
}

function summary(palette: Palette, suggestedBecause: string[]): PaletteSummary {
  return {
    id: palette.id,
    name: palette.name,
    neutrals: palette.neutrals.map(swatch),
    accents: palette.accents.map(swatch),
    combinations: palette.combinations.map((c) => ({ colors: c.colors.map(swatch), contrastLevel: c.contrastLevel })),
    rationale: palette.rationale,
    limitations: palette.limitations,
    suggestedBecause,
  };
}

const sortById = (palettes: readonly Palette[]) => [...palettes].sort((a, b) => a.id.localeCompare(b.id));

/** `view=all`: every approved palette, by ID, unranked. */
export function listAllPalettes(palettes: readonly Palette[]): PaletteSummary[] {
  return sortById(palettes).map((p) => summary(p, []));
}

/** `view=suggested`. */
export function rankPalettes(palettes: readonly Palette[], prefs: Preferences): PaletteSummary[] {
  const byId = sortById(palettes);
  const tone = (f: Record<Factor, number>) => f.undertone + f.skinTone;
  return byId
    .filter((p) => ![...p.neutrals, ...p.accents].some((c) => prefs.disliked.has(c)))
    .map((palette) => ({ palette, f: factors(palette, prefs) }))
    .sort(
      (a, b) =>
        tone(b.f) - tone(a.f) ||
        b.f.likedColors - a.f.likedColors ||
        b.f.contrastPreference - a.f.contrastPreference ||
        b.f.preferredOccasions - a.f.preferredOccasions ||
        a.palette.id.localeCompare(b.palette.id),
    )
    .map(({ palette, f }) =>
      summary(
        palette,
        FACTORS.filter((name) => f[name] > 0),
      ),
    );
}
