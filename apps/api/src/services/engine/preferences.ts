import {
  departmentScope,
  type AppearanceResponse,
  type ColorId,
  type ContrastLevel,
  type Department,
  type Fabric,
  type MonkRange,
  type Occasion,
  type ProfileResponse,
  type ProfileSizes,
  type ProportionDescriptor,
  type Silhouette,
  type Style,
  type Undertone,
} from '@styleme/contracts';

/**
 * Self-reported appearance signals as the engine sees them. The service passes `null` when the user
 * has none or has switched `useInRecommendations` off (FR-SIG-03), so the engine never sees them then.
 */
export interface EngineSignals {
  undertone: Undertone | null;
  skinTone: MonkRange | null;
  bodyProportions: ProportionDescriptor | null;
}

/** The signals the engine may use: none while `useInRecommendations` is off or nothing is set. */
export function signalsFromAppearance(appearance: AppearanceResponse): EngineSignals | null {
  if (!appearance.useInRecommendations) return null;
  const signals: EngineSignals = {
    undertone: appearance.undertone?.value ?? null,
    skinTone: appearance.skinTone?.value.monkRange ?? null,
    bodyProportions: appearance.bodyProportions?.value ?? null,
  };
  return Object.values(signals).some((v) => v !== null) ? signals : null;
}

export interface PreferenceConflict {
  field: string;
  value: string;
}

/** Profile and signals resolved once per request: hard constraints, preferences, defaults, conflicts. */
export interface Preferences {
  department: Department;
  /** False when results are general across departments (no department saved, `departmentScope()`). */
  departmentFiltered: boolean;
  /** Hard constraint (FR-LOOK-06). A colour both liked and disliked is disliked (FR-LOOK-10). */
  disliked: ReadonlySet<ColorId>;
  liked: ReadonlySet<ColorId>;
  /** Hard constraint. A fabric both liked and avoided is avoided. */
  avoidedFabrics: ReadonlySet<Fabric>;
  likedFabrics: ReadonlySet<Fabric>;
  silhouettes: ReadonlySet<Silhouette>;
  fit: ProfileResponse['fitPreferences'];
  /** `null` for "no preference". */
  contrast: ContrastLevel | null;
  styles: ReadonlySet<Style>;
  occasions: ReadonlySet<Occasion>;
  /** Hard constraint (FR-LOOK-08): the least coverage the user is comfortable with. */
  coverage: ProfileResponse['coveragePreferences'];
  sizes: ProfileSizes;
  /** Signals, only when enabled; "not sure" and "prefer not to say" count as not given. */
  undertone: Exclude<Undertone, 'not_sure'> | null;
  monkRange: readonly [number, number] | null;
  proportions: Exclude<ProportionDescriptor, 'prefer_not_to_say'> | null;
  signalsUsed: boolean;
  /** Optional inputs that fell back to defaults (FR-LOOK-09). */
  defaultsApplied: string[];
  conflicts: PreferenceConflict[];
}

export function parseMonkRange(range: MonkRange): readonly [number, number] {
  const [from, to] = range.split('-').map(Number) as [number, number];
  return [from, to];
}

export function resolvePreferences(profile: ProfileResponse, signals: EngineSignals | null): Preferences {
  const scope = departmentScope(profile);
  const defaultsApplied: string[] = [];
  const conflicts: PreferenceConflict[] = [];

  const disliked = new Set(profile.dislikedColors);
  const liked = new Set<ColorId>();
  for (const color of profile.likedColors) {
    if (disliked.has(color)) conflicts.push({ field: 'colors', value: color });
    else liked.add(color);
  }
  const avoidedFabrics = new Set(profile.fabricPreferences.avoided);
  const likedFabrics = new Set<Fabric>();
  for (const fabric of profile.fabricPreferences.liked) {
    if (avoidedFabrics.has(fabric)) conflicts.push({ field: 'fabrics', value: fabric });
    else likedFabrics.add(fabric);
  }

  const undertone = signals?.undertone && signals.undertone !== 'not_sure' ? signals.undertone : null;
  const monkRange = signals?.skinTone ? parseMonkRange(signals.skinTone) : null;
  const proportions =
    signals?.bodyProportions && signals.bodyProportions !== 'prefer_not_to_say' ? signals.bodyProportions : null;
  const signalsUsed = undertone !== null || monkRange !== null || proportions !== null;

  if (profile.department === null) defaultsApplied.push('department');
  if (liked.size === 0) defaultsApplied.push('colors');
  if (!signalsUsed) defaultsApplied.push('signals');
  if (Object.values(profile.sizes).every((size) => size === null)) defaultsApplied.push('sizes');

  return {
    department: scope.department,
    departmentFiltered: scope.filterApplied,
    disliked,
    liked,
    avoidedFabrics,
    likedFabrics,
    silhouettes: new Set(profile.silhouettePreferences),
    fit: profile.fitPreferences,
    contrast:
      profile.contrastPreference && profile.contrastPreference !== 'no_preference' ? profile.contrastPreference : null,
    styles: new Set(profile.preferredStyles),
    occasions: new Set(profile.preferredOccasions),
    coverage: profile.coveragePreferences,
    sizes: profile.sizes,
    undertone,
    monkRange,
    proportions,
    signalsUsed,
    defaultsApplied,
    conflicts,
  };
}
