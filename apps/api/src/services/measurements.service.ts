import type { Types } from 'mongoose';
import {
  BODY_TYPE_RULES_VERSION,
  MEASUREMENT_ORDER,
  classifyBodyType,
  type BodyMeasurementId,
  type ClothingPreference,
  type MeasurementUnit,
  type MeasurementValues,
  type MeasurementsResponse,
  type UpdateMeasurementsRequest,
} from '@styleme/contracts';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';
import type { AppearanceService } from './appearance.service';

// Body measurements (D-129), stored in centimetres on the user's profile. Saving the body-type
// measurements identifies the body type deterministically (`classifyBodyType`) and stores it at once for
// review, with an `appearanceAnalyses` record (source `measurements`). Values are never logged.

interface StoredMeasurements {
  displayUnit?: MeasurementUnit;
  valuesCm?: MeasurementValues;
  updatedAt?: Date;
}

function asClothingPreference(department: unknown): ClothingPreference | null {
  return department === 'women' || department === 'men' ? department : null;
}

/** Only the measurements asked for this Clothing Preference (others stay stored but are not shown). */
function relevant(department: ClothingPreference | null, values: MeasurementValues): MeasurementValues {
  if (!department) return {};
  const ids: readonly BodyMeasurementId[] = [
    ...MEASUREMENT_ORDER[department].body_type,
    ...MEASUREMENT_ORDER[department].fit,
  ];
  return Object.fromEntries(Object.entries(values).filter(([id]) => ids.includes(id as BodyMeasurementId)));
}

function toResponse(
  department: ClothingPreference | null,
  stored: StoredMeasurements | undefined,
): MeasurementsResponse {
  const valuesCm = relevant(department, stored?.valuesCm ?? {});
  return {
    displayUnit: stored?.displayUnit ?? 'in',
    valuesCm,
    updatedAt: stored?.updatedAt ? stored.updatedAt.toISOString() : null,
    bodyTypeFromMeasurements: department ? classifyBodyType(department, valuesCm) : null,
  };
}

export class MeasurementsService {
  constructor(
    private readonly models: Models,
    private readonly appearance: AppearanceService,
  ) {}

  async get(userId: Types.ObjectId): Promise<MeasurementsResponse> {
    const profile = await this.models.Profile.findOne({ userId }).lean();
    return toResponse(asClothingPreference(profile?.department), profile?.measurements as StoredMeasurements);
  }

  async update(userId: Types.ObjectId, input: UpdateMeasurementsRequest): Promise<MeasurementsResponse> {
    const profile = await this.models.Profile.findOne({ userId }).lean();
    const department = asClothingPreference(profile?.department);
    if (!profile || !department) throw new AppError('CONFLICT', 'Choose your clothing preference first.');

    const allowed: readonly BodyMeasurementId[] = [
      ...MEASUREMENT_ORDER[department].body_type,
      ...MEASUREMENT_ORDER[department].fit,
    ];
    const touched = [...Object.keys(input.valuesCm), ...(input.clear ?? [])] as BodyMeasurementId[];
    if (touched.some((id) => !allowed.includes(id))) {
      throw new AppError('INVALID_REQUEST', 'These measurements are not used for your clothing preference.');
    }

    const stored = (profile.measurements ?? {}) as StoredMeasurements;
    const before = relevant(department, stored.valuesCm ?? {});
    const valuesCm: MeasurementValues = { ...(stored.valuesCm ?? {}), ...input.valuesCm };
    for (const id of input.clear ?? []) delete valuesCm[id];
    const measurements = { displayUnit: input.displayUnit, valuesCm, updatedAt: new Date() };
    await this.models.Profile.updateOne({ userId }, { $set: { measurements } });

    // Identify the body type again only when the body-type measurements changed.
    const bodyTypeIds = MEASUREMENT_ORDER[department].body_type;
    const changed = bodyTypeIds.some((id) => before[id] !== valuesCm[id]);
    const bodyType = classifyBodyType(department, valuesCm);
    if (changed && bodyType) {
      const analysis = await this.models.AppearanceAnalysis.create({
        userId,
        kind: 'body_shape',
        source: 'measurements',
        result: { bodyType },
        confidence: null,
        status: 'pending_review',
        analysisVersion: BODY_TYPE_RULES_VERSION,
      });
      await this.models.AppearanceAnalysis.updateMany(
        { userId, kind: 'body_shape', status: 'pending_review', _id: { $ne: analysis._id } },
        { $set: { status: 'superseded' } },
      );
      await this.appearance.applyEstimate(userId, {
        source: 'measurements',
        analysisId: analysis._id,
        confidence: null,
        values: { bodyType },
      });
    }
    return toResponse(department, measurements);
  }
}
