import type { Models } from '../models/index';
import type { ColourLibraryContent } from './content';
import { buildColourLibrary, type ColourLibrary } from './library';

// Writes the colour library (D-133) to MongoDB. Safe to re-run: colours are matched by `colourId` and
// categories by `categoryId`. Colours that left the master list are retired, never deleted, so the IDs in
// users' liked and avoided lists stay resolvable.

export interface ColourSeedResult {
  colours: number;
  retiredColours: number;
  categories: number;
  coloursPerCategory: number;
  reviewStatus: ColourLibraryContent['reviewStatus'];
}

export async function seedColourLibrary(
  models: Models,
  content: ColourLibraryContent,
  library: ColourLibrary = buildColourLibrary(content),
): Promise<ColourSeedResult> {
  await models.ColourSwatch.bulkWrite(
    library.colours.map((c, i) => ({
      updateOne: {
        filter: { colourId: c.colourId },
        update: {
          $set: {
            name: c.name,
            hex: c.hex,
            rgb: c.rgb,
            oklch: { l: round(c.oklch.l), c: round(c.oklch.c), h: Math.round(c.oklch.h * 10) / 10 },
            family: c.family,
            temperature: c.temperature,
            depth: c.depth,
            intensity: c.intensity,
            source: c.source,
            sortOrder: i + 1,
            status: 'published',
          },
        },
        upsert: true,
      },
    })),
  );
  const retired = await models.ColourSwatch.updateMany(
    { colourId: { $nin: library.colours.map((c) => c.colourId) }, status: 'published' },
    { $set: { status: 'retired' } },
  );

  await models.ColourCategory.bulkWrite(
    library.categories.map((cat) => ({
      updateOne: {
        filter: { categoryId: cat.categoryId },
        update: {
          $set: {
            ...cat,
            contentVersion: content.version,
            reviewStatus: content.reviewStatus,
            reviewedBy: content.reviewedBy,
            reviewedAt: content.reviewedAt ? new Date(content.reviewedAt) : null,
          },
        },
        upsert: true,
      },
    })),
  );

  return {
    colours: library.colours.length,
    retiredColours: retired.modifiedCount,
    categories: library.categories.length,
    coloursPerCategory: content.coloursPerCategory,
    reviewStatus: content.reviewStatus,
  };
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}
