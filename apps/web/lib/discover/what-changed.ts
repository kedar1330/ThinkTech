import {
  CATEGORY_GROUPS,
  COLORS,
  CONTRAST_PREFERENCES,
  DEPARTMENTS,
  FABRICS,
  FITS,
  GARMENT_LENGTHS,
  HEIGHT_BANDS,
  NECKLINE_DEPTHS,
  SILHOUETTES,
  SLEEVE_LENGTHS,
  STYLES,
  heightBand,
  type LookInputs,
  type ProfileResponse,
} from '@styleme/contracts';

// "What changed" for regenerate (#49): compares the profile inputs a look was generated from with the
// inputs used now, field by field, in plain words. Values come from the user's own profile; nothing is
// inferred.

type Vocabulary = readonly { id: string; label: string }[];
/** The inputs to compare. `signalsUsed` is known only when the new request produced a look. */
export type ComparableInputs = Omit<LookInputs, 'departmentFiltered' | 'signalsUsed'> & { signalsUsed?: boolean };

const name = (list: Vocabulary, id: string) => list.find((o) => o.id === id)?.label ?? id;
const lower = (list: Vocabulary, id: string) => name(list, id).toLowerCase();

function joined(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

function listChange(what: string, list: Vocabulary, before: readonly string[], after: readonly string[]): string[] {
  const added = after.filter((id) => !before.includes(id)).map((id) => lower(list, id));
  const removed = before.filter((id) => !after.includes(id)).map((id) => lower(list, id));
  return [
    ...(added.length ? [`${what} now include ${joined(added)}.`] : []),
    ...(removed.length ? [`${what} no longer include ${joined(removed)}.`] : []),
  ];
}

function valueChange(what: string, list: Vocabulary, before: string | null, after: string | null): string[] {
  if (before === after) return [];
  return after === null ? [`${what} was cleared.`] : [`${what} changed to ${lower(list, after)}.`];
}

/** The same fields as the API's stored snapshot, from a profile (used when a regenerate gives no look). */
export function inputsFromProfile(profile: ProfileResponse): ComparableInputs {
  return {
    department: profile.department,
    likedColors: profile.likedColors,
    dislikedColors: profile.dislikedColors,
    contrastPreference: profile.contrastPreference,
    silhouettePreferences: profile.silhouettePreferences,
    fitPreferences: profile.fitPreferences,
    coveragePreferences: profile.coveragePreferences,
    fabricPreferences: profile.fabricPreferences,
    preferredStyles: profile.preferredStyles,
    sizesSaved: (Object.keys(profile.sizes) as (keyof ProfileResponse['sizes'])[]).filter((g) => profile.sizes[g]),
    heightBand: heightBand(profile.department, profile.heightCm),
  };
}

export function whatChanged(before: LookInputs, after: ComparableInputs): string[] {
  const changes: string[] = [];

  if (before.department !== after.department) {
    if (after.department === null)
      changes.push('Your department was cleared, so looks can come from every department.');
    else if (before.department === null)
      changes.push(`You chose a department: ${name(DEPARTMENTS, after.department)}.`);
    else
      changes.push(
        `Your department changed from ${name(DEPARTMENTS, before.department)} to ${name(DEPARTMENTS, after.department)}.`,
      );
  }

  changes.push(
    ...listChange('Your liked colours', COLORS, before.likedColors, after.likedColors),
    ...listChange('Your avoided colours', COLORS, before.dislikedColors, after.dislikedColors),
    ...listChange('Your liked fabrics', FABRICS, before.fabricPreferences.liked, after.fabricPreferences.liked),
    ...listChange('Your avoided fabrics', FABRICS, before.fabricPreferences.avoided, after.fabricPreferences.avoided),
    ...listChange('Your preferred styles', STYLES, before.preferredStyles, after.preferredStyles),
    ...listChange('Your preferred shapes', SILHOUETTES, before.silhouettePreferences, after.silhouettePreferences),
    ...valueChange(
      'Your contrast preference',
      CONTRAST_PREFERENCES,
      before.contrastPreference,
      after.contrastPreference,
    ),
  );

  for (const group of Object.keys(before.fitPreferences) as (keyof LookInputs['fitPreferences'])[])
    changes.push(
      ...valueChange(
        `Your preferred fit for ${lower(CATEGORY_GROUPS, group)}`,
        FITS,
        before.fitPreferences[group],
        after.fitPreferences[group] ?? null,
      ),
    );

  const coverage = before.coveragePreferences;
  const now = after.coveragePreferences;
  changes.push(
    ...valueChange('Your minimum sleeve length', SLEEVE_LENGTHS, coverage.minSleeveLength, now.minSleeveLength),
    ...valueChange(
      'Your minimum neckline coverage',
      NECKLINE_DEPTHS,
      coverage.minNecklineCoverage,
      now.minNecklineCoverage,
    ),
    ...valueChange('Your minimum garment length', GARMENT_LENGTHS, coverage.minGarmentLength, now.minGarmentLength),
  );

  // Looks made before height existed (D-131) have no height band; nothing to compare then.
  if (before.heightBand !== undefined)
    changes.push(...valueChange('Your height band', HEIGHT_BANDS, before.heightBand, after.heightBand ?? null));

  const addedSizes = after.sizesSaved
    .filter((g) => !before.sizesSaved.includes(g))
    .map((g) => lower(CATEGORY_GROUPS, g));
  const removedSizes = before.sizesSaved
    .filter((g) => !after.sizesSaved.includes(g))
    .map((g) => lower(CATEGORY_GROUPS, g));
  if (addedSizes.length) changes.push(`You added your size for ${joined(addedSizes)}.`);
  if (removedSizes.length) changes.push(`You removed your size for ${joined(removedSizes)}.`);

  if (after.signalsUsed !== undefined && after.signalsUsed !== before.signalsUsed)
    changes.push(
      after.signalsUsed ? 'Your appearance signals are now used.' : 'Your appearance signals are no longer used.',
    );

  return changes;
}
