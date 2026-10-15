import type { ProfileResponse } from './profile';
import type { Department } from './style-vocabulary';

// Profile completeness (FR-ONB-05). Users may skip the style profile during onboarding; Home, the
// navigation and features then show what is missing and how to add it. Only the details that shape
// recommendations count. Appearance signals and the finer preferences (fit, coverage, fabrics,
// comfort, contrast) stay optional and never make a profile "incomplete".

export const PROFILE_COMPLETENESS_ITEMS = [
  { id: 'department', label: 'Department', hint: 'Which clothes to suggest: women, men or everything.' },
  { id: 'city', label: 'City', hint: 'For region-aware styling.' },
  { id: 'sizes', label: 'Sizes', hint: 'At least one size, so suggestions fit.' },
  { id: 'likedColors', label: 'Colours you love', hint: 'Colours StyleMe should favour.' },
  { id: 'occasions', label: 'Occasions', hint: 'What you dress for most often.' },
  { id: 'styles', label: 'Styles', hint: 'The looks you like, such as classic or fusion.' },
  { id: 'budget', label: 'Budget per look', hint: 'Keeps ideas within what you want to spend.' },
] as const;

export type ProfileCompletenessItemId = (typeof PROFILE_COMPLETENESS_ITEMS)[number]['id'];
export type ProfileCompletenessItem = (typeof PROFILE_COMPLETENESS_ITEMS)[number];

export interface ProfileCompleteness {
  complete: boolean;
  /** Items present. */
  done: number;
  total: number;
  /** Items still missing, in display order. */
  missing: ProfileCompletenessItem[];
}

/** What is still missing from a user's profile. `city` comes from the account, the rest from the profile. */
export function profileCompleteness(
  profile: Pick<
    ProfileResponse,
    'department' | 'sizes' | 'likedColors' | 'preferredOccasions' | 'preferredStyles' | 'budgetPreference'
  >,
  user: { city: string | null },
): ProfileCompleteness {
  const present: Record<ProfileCompletenessItemId, boolean> = {
    department: profile.department !== null,
    city: Boolean(user.city),
    sizes: Object.values(profile.sizes ?? {}).some((size) => size !== null && size !== undefined),
    likedColors: profile.likedColors.length > 0,
    occasions: profile.preferredOccasions.length > 0,
    styles: profile.preferredStyles.length > 0,
    budget: profile.budgetPreference !== null,
  };
  const missing = PROFILE_COMPLETENESS_ITEMS.filter((item) => !present[item.id]);
  return {
    complete: missing.length === 0,
    done: PROFILE_COMPLETENESS_ITEMS.length - missing.length,
    total: PROFILE_COMPLETENESS_ITEMS.length,
    missing,
  };
}

/**
 * The department a feature should use. Without one (the user skipped the style profile), features give
 * general results across all departments and must say that no department filter is applied.
 */
export function departmentScope(profile: Pick<ProfileResponse, 'department'>): {
  department: Department;
  filterApplied: boolean;
} {
  return profile.department === null
    ? { department: 'any', filterApplied: false }
    : { department: profile.department, filterApplied: profile.department !== 'any' };
}
