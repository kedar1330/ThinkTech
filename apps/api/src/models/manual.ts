import { Schema, type InferSchemaType } from 'mongoose';
import { MANUAL_STEP_STATUSES, DEFAULT_MANUAL_STEPS } from '@styleme/contracts';
export { DEFAULT_MANUAL_STEPS };

export const manualStepSchema = new Schema(
  {
    stepNumber: { type: Number, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    tagline: { type: String, required: true },
    description: { type: String, required: true },
    actionLabel: { type: String, required: true },
    actionHref: { type: String, required: true },
    imageUrl: { type: String, required: true },
    imageData: { type: String, default: null },
    imageAlt: { type: String, required: true },
    highlights: { type: [String], default: [] },
    category: { type: String, required: true },
    status: { type: String, enum: MANUAL_STEP_STATUSES, default: 'live', required: true },
    sortOrder: { type: Number, default: 0, required: true },
    isFixture: { type: Boolean, default: undefined },
  },
  { timestamps: true },
);

manualStepSchema.index({ sortOrder: 1 });

export type ManualStepDoc = InferSchemaType<typeof manualStepSchema>;
