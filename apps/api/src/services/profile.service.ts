import type { Types } from 'mongoose';
import { bodyTypesFor, type ProfileResponse, type UpdateProfileRequest } from '@styleme/contracts';
import type { Models, ProfileDoc } from '../models/index';

// Style profile (FR-PROF-01 … 06, FR-SIZE-01 … 04, D-129). One document per user. `department` (the
// Clothing Preference) is always sent; other fields are unchanged when omitted, cleared when `null` (or an
// empty list). Changing the Clothing Preference clears a body type that the new list doesn't offer.

const LIST_FIELDS = [
  'likedColors',
  'dislikedColors',
  'silhouettePreferences',
  'comfortPreferences',
  'preferredStyles',
  'preferredOccasions',
] as const;

const OBJECT_FIELDS = ['sizes', 'fitPreferences', 'coveragePreferences'] as const;

/** Drops `null`/`undefined` entries, so a cleared size or fit isn't stored. */
function compact(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value ?? {}).filter(([, v]) => v !== null && v !== undefined));
}

function pick<T>(source: Record<string, unknown> | undefined, keys: readonly string[]): T {
  return Object.fromEntries(keys.map((k) => [k, source?.[k] ?? null])) as T;
}

export function emptyProfile(): ProfileResponse {
  return toResponse(null);
}

function toResponse(doc: (ProfileDoc & { updatedAt?: Date }) | null): ProfileResponse {
  const fabrics = (doc?.fabricPreferences ?? {}) as { liked?: string[]; avoided?: string[] };
  return {
    department: (doc?.department as ProfileResponse['department']) ?? null,
    ageGroup: (doc?.ageGroup as ProfileResponse['ageGroup']) ?? null,
    heightCm: doc?.heightCm ?? null,
    sizes: pick(doc?.sizes as Record<string, unknown>, ['tops', 'bottoms', 'ethnicTops', 'ethnicSets', 'shoes']),
    fitPreferences: pick(doc?.fitPreferences as Record<string, unknown>, [
      'tops',
      'bottoms',
      'ethnicTops',
      'ethnicSets',
    ]),
    likedColors: (doc?.likedColors ?? []) as ProfileResponse['likedColors'],
    dislikedColors: (doc?.dislikedColors ?? []) as ProfileResponse['dislikedColors'],
    contrastPreference: (doc?.contrastPreference as ProfileResponse['contrastPreference']) ?? null,
    silhouettePreferences: (doc?.silhouettePreferences ?? []) as ProfileResponse['silhouettePreferences'],
    coveragePreferences: pick(doc?.coveragePreferences as Record<string, unknown>, [
      'minSleeveLength',
      'minNecklineCoverage',
      'minGarmentLength',
    ]),
    comfortPreferences: (doc?.comfortPreferences ?? []) as ProfileResponse['comfortPreferences'],
    fabricPreferences: {
      liked: (fabrics.liked ?? []) as ProfileResponse['fabricPreferences']['liked'],
      avoided: (fabrics.avoided ?? []) as ProfileResponse['fabricPreferences']['avoided'],
    },
    preferredStyles: (doc?.preferredStyles ?? []) as ProfileResponse['preferredStyles'],
    preferredOccasions: (doc?.preferredOccasions ?? []) as ProfileResponse['preferredOccasions'],
    budgetPreference: doc?.budgetPreference ?? null,
    tryOnModel: (doc?.tryOnModel as ProfileResponse['tryOnModel']) ?? 'dummy_model',
    updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
  };
}

export class ProfileService {
  constructor(private readonly models: Models) {}

  async get(userId: Types.ObjectId): Promise<ProfileResponse> {
    return toResponse(await this.models.Profile.findOne({ userId }).lean());
  }

  async update(userId: Types.ObjectId, input: UpdateProfileRequest): Promise<ProfileResponse> {
    const set: Record<string, unknown> = { department: input.department };
    for (const field of LIST_FIELDS) {
      if (input[field] !== undefined) set[field] = input[field] ?? [];
    }
    for (const field of OBJECT_FIELDS) {
      if (input[field] !== undefined) set[field] = compact(input[field] as Record<string, unknown> | null);
    }
    if (input.fabricPreferences !== undefined)
      set.fabricPreferences = input.fabricPreferences ?? { liked: [], avoided: [] };
    if (input.contrastPreference !== undefined) set.contrastPreference = input.contrastPreference;
    if (input.budgetPreference !== undefined) set.budgetPreference = input.budgetPreference;
    if (input.ageGroup !== undefined) set.ageGroup = input.ageGroup;
    if (input.heightCm !== undefined) set.heightCm = input.heightCm;
    if (input.tryOnModel !== undefined) set.tryOnModel = input.tryOnModel;

    const doc = await this.models.Profile.findOneAndUpdate(
      { userId },
      { $set: set, $setOnInsert: { userId } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    ).lean();
    await this.models.AppearanceProfile.updateOne(
      { userId, 'bodyType.value': { $nin: [...bodyTypesFor(input.department)] }, bodyType: { $ne: null } },
      { $set: { bodyType: null, bodyProportions: null } },
    );
    return toResponse(doc);
  }
}
