import { updateProfileRequestSchema, type UpdateProfileRequest } from '@styleme/contracts';

// Turns the My Profile basics form into a PUT /v1/profile body (D-129). The form asks for the Clothing
// Preference, height (D-131), age group, budget and fabrics. Colours, fit, contrast, silhouettes, coverage,
// comfort, styles, occasions and letter sizes are no longer asked in My Profile, so saving clears any values left
// from the earlier profile: they are asked per outfit in Discover My Style and Shop My Look instead.

export interface FormLike {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

export type ProfileFormResult = { ok: true; body: UpdateProfileRequest } | { ok: false; error: string };

const text = (form: FormLike, name: string) => String(form.get(name) ?? '').trim();

const CM_PER_INCH = 2.54;

/** Feet and inches for a height in centimetres, for showing a saved height. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(total / 12), inches: total % 12 };
}

/**
 * The height in whole centimetres from the form: `heightCm`, or `heightFt` + `heightIn` when `heightUnit` is
 * `ft_in`. Null when left empty; NaN when not a number (the schema then rejects it).
 */
function heightFromForm(form: FormLike): number | null {
  if (text(form, 'heightUnit') === 'ft_in') {
    const feet = text(form, 'heightFt');
    const inches = text(form, 'heightIn');
    if (feet === '' && inches === '') return null;
    return Math.round((Number(feet || 0) * 12 + Number(inches || 0)) * CM_PER_INCH);
  }
  const cm = text(form, 'heightCm');
  return cm === '' ? null : Math.round(Number(cm));
}

/** Fields no longer asked in My Profile; sent cleared (D-129). */
export const RETIRED_PROFILE_FIELDS = {
  sizes: null,
  fitPreferences: null,
  likedColors: [],
  dislikedColors: [],
  contrastPreference: null,
  silhouettePreferences: [],
  coveragePreferences: null,
  comfortPreferences: [],
  preferredStyles: [],
  preferredOccasions: [],
} as const satisfies Partial<UpdateProfileRequest>;

export function profileFormToRequest(form: FormLike, ids: { fabrics: readonly string[] }): ProfileFormResult {
  const department = text(form, 'department');
  if (department !== 'women' && department !== 'men') {
    return { ok: false, error: 'Choose your clothing preference: Women’s Wear or Men’s Wear.' };
  }

  const liked: string[] = [];
  const avoided: string[] = [];
  for (const id of ids.fabrics) {
    const value = text(form, `fabric_${id}`);
    if (value === 'like') liked.push(id);
    if (value === 'avoid') avoided.push(id);
  }
  const budget = text(form, 'budgetPreference');

  const parsed = updateProfileRequestSchema.safeParse({
    department,
    ageGroup: text(form, 'ageGroup') || null,
    heightCm: heightFromForm(form),
    budgetPreference: budget === '' ? null : Number(budget),
    fabricPreferences: { liked, avoided },
    ...RETIRED_PROFILE_FIELDS,
  });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? '');
    if (field === 'budgetPreference') return { ok: false, error: 'Please check the budget: whole rupees, above 0.' };
    if (field === 'ageGroup') return { ok: false, error: 'Please choose an age group from the list.' };
    if (field === 'heightCm')
      return { ok: false, error: 'Please check your height: between 120 and 230 cm (3 ft 11 in to 7 ft 6 in).' };
    return { ok: false, error: 'Please choose from the options shown.' };
  }
  return { ok: true, body: parsed.data };
}
