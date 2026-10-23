import { Schema } from 'mongoose';
import {
  COLOUR_DEPTHS,
  COMBINATION_HARMONIES,
  COMBINATION_ROLES,
  COLOUR_FAMILY_IDS,
  COLOUR_INTENSITIES,
  COLOUR_PREFERENCES,
  COLOUR_SOURCES,
  COLOUR_TEMPERATURES,
  LIBRARY_UNDERTONE_IDS,
} from '@styleme/contracts';

// Colour library (D-133, DATABASE.md §4d): the shared master list of named colours, the 40 skin tone ×
// undertone categories that rank them, and each user's liked and avoided colours. The two shared collections
// are rebuilt by `pnpm --filter @styleme/api colours:seed`; the user collection is keyed by `userId` and
// listed in USER_OWNED_COLLECTIONS.

const fixtureField = { isFixture: { type: Boolean, default: undefined } } as const;

/** One named colour (`CLR-0001`), from an openly licensed list. */
export const colourSwatchSchema = new Schema(
  {
    colourId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    hex: { type: String, required: true },
    rgb: { type: [Number], required: true },
    oklch: {
      type: new Schema({ l: Number, c: Number, h: Number }, { _id: false }),
      required: true,
    },
    family: { type: String, enum: COLOUR_FAMILY_IDS, required: true },
    temperature: { type: String, enum: COLOUR_TEMPERATURES, required: true },
    depth: { type: String, enum: COLOUR_DEPTHS, required: true },
    intensity: { type: String, enum: COLOUR_INTENSITIES, required: true },
    source: { type: String, enum: COLOUR_SOURCES, required: true },
    sortOrder: { type: Number, default: 0 },
    status: { type: String, enum: ['published', 'retired'], default: 'published', required: true },
    ...fixtureField,
  },
  { timestamps: true },
);
colourSwatchSchema.index({ family: 1, status: 1 });

/**
 * One Monk tone and undertone (`monk-06-warm`) with its ranked colours. Styling content: served to users only
 * once `reviewStatus` is `approved`, except that local and staging may preview a draft (D-133).
 */
export const colourCategorySchema = new Schema(
  {
    categoryId: { type: String, required: true, unique: true },
    monkTone: { type: Number, min: 1, max: 10, required: true },
    undertone: { type: String, enum: LIBRARY_UNDERTONE_IDS, required: true },
    label: { type: String, required: true },
    skinHex: { type: String, required: true },
    rationale: { type: String, required: true },
    limitations: { type: String, required: true },
    colours: {
      type: [
        new Schema(
          {
            colourId: { type: String, required: true },
            score: { type: Number, min: 0, max: 100, required: true },
            rank: { type: Number, required: true },
            reasons: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    contentVersion: { type: Number, required: true },
    reviewStatus: { type: String, enum: ['draft', 'approved'], default: 'draft', required: true },
    reviewedBy: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    ...fixtureField,
  },
  { timestamps: true },
);
colourCategorySchema.index({ monkTone: 1, undertone: 1 }, { unique: true });

/** The user's liked and avoided colours; one document per user, newest choices last. */
export const userColourPreferenceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    colours: {
      type: [
        new Schema(
          {
            colourId: { type: String, required: true },
            preference: { type: String, enum: COLOUR_PREFERENCES, required: true },
            savedAt: { type: Date, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    ...fixtureField,
  },
  { timestamps: true },
);

/**
 * The user's coordinating colours and curated combinations (#105), built from their own category minus avoided
 * colours. One document per user; `inputsKey` records what it was built from, so a change of category,
 * content or liked / avoided colours rebuilds it on the next read.
 */
export const userColourCombinationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    inputsKey: { type: String, required: true },
    categoryId: { type: String, required: true },
    combinations: {
      type: [
        new Schema(
          {
            combinationId: { type: String, required: true },
            harmony: { type: String, enum: COMBINATION_HARMONIES.map((h) => h.id), required: true },
            colours: {
              type: [
                new Schema(
                  {
                    colourId: { type: String, required: true },
                    role: { type: String, enum: COMBINATION_ROLES, required: true },
                  },
                  { _id: false },
                ),
              ],
              default: [],
            },
            score: { type: Number, min: 0, max: 100, required: true },
            likedCount: { type: Number, min: 0, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    coordinating: {
      type: [new Schema({ colourId: { type: String, required: true }, matches: [String] }, { _id: false })],
      default: [],
    },
    generatedAt: { type: Date, required: true },
    ...fixtureField,
  },
  { timestamps: true },
);
