import type { AppearanceResponse } from './appearance';
import type { ProfileResponse } from './profile';
import type { Department } from './style-vocabulary';

// Profile completeness (FR-ONB-05, revised by D-129). Users may skip the profile during onboarding; Home,
// the navigation and features then show what is missing and how to add it. My Profile asks for the
// Clothing Preference, height (D-131), skin tone and undertone, and body type; the city comes from the
// account. Fit measurements, budget, fabrics and age group stay optional and never make a profile
// "incomplete".

export const PROFILE_COMPLETENESS_ITEMS = [
  { id: 'department', label: 'Clothing preference', hint: 'Women’s Wear or Men’s Wear.' },
  { id: 'height', label: 'Height', hint: 'The most useful detail for lengths and cuts that suit you.' },
  { id: 'city', label: 'City', hint: 'For region-aware styling.' },
  { id: 'skinTone', label: 'Skin tone & undertone', hint: 'From a face photo, or choose them yourself.' },
  { id: 'bodyType', label: 'Body type', hint: 'From your measurements or a full-body photo.' },
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

/**
 * What is still missing from a user's profile. `city` comes from the account, the Clothing Preference from
 * the profile, and skin tone, undertone and body type from appearance (`null` when it couldn't be loaded:
 * those items then count as missing). A pre-D-129 `any` department counts as not chosen.
 */
export function profileCompleteness(
  profile: Pick<ProfileResponse, 'department' | 'heightCm'>,
  user: { city: string | null },
  appearance: Pick<AppearanceResponse, 'skinTone' | 'undertone' | 'bodyType'> | null,
): ProfileCompleteness {
  const present: Record<ProfileCompletenessItemId, boolean> = {
    department: profile.department === 'women' || profile.department === 'men',
    height: profile.heightCm !== null,
    city: Boolean(user.city),
    skinTone: Boolean(appearance?.skinTone && appearance.undertone),
    bodyType: Boolean(appearance?.bodyType),
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
