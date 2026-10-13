import { updateProfileRequestSchema, type UpdateProfileRequest } from '@styleme/contracts';

// Turns the style-profile form into a PUT /v1/profile body. The form always shows every field, so it
// sends the complete state: an empty choice clears that field.

export interface FormLike {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

export type ProfileFormResult = { ok: true; body: UpdateProfileRequest } | { ok: false; error: string };

const FIELD_NAMES: Record<string, string> = {
  department: 'department',
  sizes: 'sizes',
  tops: 'top size',
  bottoms: 'bottom size',
  ethnicTops: 'ethnic top size',
  ethnicSets: 'ethnic set size',
  shoes: 'shoe size',
  collarIn: 'collar size',
  waistIn: 'waist size',
  lengthIn: 'length',
  numeric: 'numeric size',
  uk: 'shoe size',
  budgetPreference: 'budget',
};

const text = (form: FormLike, name: string) => String(form.get(name) ?? '').trim();
const optionalNumber = (form: FormLike, name: string) => {
  const value = text(form, name);
  return value === '' ? undefined : Number(value);
};
const list = (form: FormLike, name: string) => form.getAll(name).map(String);

/** Fields named `<prefix><id>` with value `positive` or `negative` (e.g. colour like/avoid choices). */
function triState(form: FormLike, prefix: string, ids: readonly string[], positive: string, negative: string) {
  const yes: string[] = [];
  const no: string[] = [];
  for (const id of ids) {
    const value = text(form, `${prefix}${id}`);
    if (value === positive) yes.push(id);
    if (value === negative) no.push(id);
  }
  return [yes, no] as const;
}

export function profileFormToRequest(
  form: FormLike,
  ids: { colors: readonly string[]; fabrics: readonly string[] },
): ProfileFormResult {
  const department = text(form, 'department');
  if (!department) return { ok: false, error: 'Choose a department — it is the only required field.' };

  const topsLetter = text(form, 'size_tops_letter');
  const collarIn = optionalNumber(form, 'size_tops_collar');
  const waistIn = optionalNumber(form, 'size_bottoms_waist');
  const lengthIn = optionalNumber(form, 'size_bottoms_length');
  const ethnicTopsLetter = text(form, 'size_ethnicTops_letter');
  const ethnicTopsNumeric = optionalNumber(form, 'size_ethnicTops_numeric');
  const ethnicSetsLetter = text(form, 'size_ethnicSets_letter');
  const ethnicSetsWaist = optionalNumber(form, 'size_ethnicSets_waist');
  const shoes = optionalNumber(form, 'size_shoes_uk');

  if (collarIn !== undefined && !topsLetter) return { ok: false, error: 'Add a top size to go with the collar size.' };
  if (lengthIn !== undefined && waistIn === undefined)
    return { ok: false, error: 'Add a waist size to go with the length.' };

  const [likedColors, dislikedColors] = triState(form, 'color_', ids.colors, 'like', 'avoid');
  const [likedFabrics, avoidedFabrics] = triState(form, 'fabric_', ids.fabrics, 'like', 'avoid');
  const budget = optionalNumber(form, 'budgetPreference');

  const candidate = {
    department,
    sizes: {
      tops: topsLetter ? { letter: topsLetter, ...(collarIn !== undefined ? { collarIn } : {}) } : null,
      bottoms: waistIn !== undefined ? { waistIn, ...(lengthIn !== undefined ? { lengthIn } : {}) } : null,
      ethnicTops:
        ethnicTopsLetter || ethnicTopsNumeric !== undefined
          ? {
              ...(ethnicTopsLetter ? { letter: ethnicTopsLetter } : {}),
              ...(ethnicTopsNumeric !== undefined ? { numeric: ethnicTopsNumeric } : {}),
            }
          : null,
      ethnicSets:
        ethnicSetsLetter || ethnicSetsWaist !== undefined
          ? {
              ...(ethnicSetsLetter ? { letter: ethnicSetsLetter } : {}),
              ...(ethnicSetsWaist !== undefined ? { waistIn: ethnicSetsWaist } : {}),
            }
          : null,
      shoes: shoes !== undefined ? { uk: shoes } : null,
    },
    fitPreferences: {
      tops: text(form, 'fit_tops') || null,
      bottoms: text(form, 'fit_bottoms') || null,
      ethnicTops: text(form, 'fit_ethnicTops') || null,
      ethnicSets: text(form, 'fit_ethnicSets') || null,
    },
    likedColors,
    dislikedColors,
    contrastPreference: text(form, 'contrastPreference') || null,
    silhouettePreferences: list(form, 'silhouettes'),
    coveragePreferences: {
      minSleeveLength: text(form, 'coverage_sleeve') || null,
      minNecklineCoverage: text(form, 'coverage_neckline') || null,
      minGarmentLength: text(form, 'coverage_length') || null,
    },
    comfortPreferences: list(form, 'comfort'),
    fabricPreferences: { liked: likedFabrics, avoided: avoidedFabrics },
    preferredStyles: list(form, 'styles'),
    preferredOccasions: list(form, 'occasions'),
    budgetPreference: budget ?? null,
  };

  const parsed = updateProfileRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.map(String) ?? [];
    const field = [...path].reverse().find((p) => FIELD_NAMES[p]);
    return {
      ok: false,
      error: field ? `Please check the ${FIELD_NAMES[field]}.` : 'Please choose from the options shown.',
    };
  }
  return { ok: true, body: parsed.data };
}
