import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  COLOUR_FAMILIES,
  COLOUR_LIBRARY_LIMITS,
  COMBINATION_HARMONIES,
  LIBRARY_UNDERTONE_IDS,
  colourCategoryId,
  type CategoryColourItem,
  type ColourCategoryId,
  type ColourCategorySummary,
  type ColourItem,
  type ColourPreference,
  type ColourPreferencesResponse,
  type CombinationHarmony,
  type CombinationRole,
  type ColourReviewStatus,
  type LibraryUndertone,
  type MyColoursMissing,
  type MyColourCombinationsResponse,
  type MyColoursResponse,
  type UpdateColourPreferencesRequest,
} from '@styleme/contracts';
import {
  COMBINATION_REASONS,
  COMBINATION_RULES_VERSION,
  generateCombinations,
  type GeneratedCombinations,
} from '../colours/combinations';
import type { Config } from '../config/env';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';

// Colour library (D-133, API.md §3.13): Monk tone → undertone → 100+ suggested colours, and the user's liked
// and avoided colours. Each user is shown only their own category, from the skin tone and undertone in My
// Profile, and only while they allow appearance signals; the other 39 are never served. Categories are styling
// content: production serves only founder-approved ones; local and staging also serve a seeded draft.

type UserId = Types.ObjectId;

interface SwatchDoc {
  colourId: string;
  name: string;
  hex: string;
  family: string;
  temperature: string;
  depth: string;
  intensity: string;
  oklch: { l: number; c: number; h: number };
  source: string;
}

interface CategoryDoc {
  categoryId: string;
  monkTone: number;
  undertone: string;
  label: string;
  skinHex: string;
  rationale: string;
  limitations: string;
  reviewStatus: string;
  contentVersion: number;
  colours: Array<{ colourId: string; score: number; rank: number; reasons: string[] }>;
}

function colourItem(s: SwatchDoc, preference: ColourPreference | null): ColourItem {
  return {
    colourId: s.colourId,
    name: s.name,
    hex: s.hex,
    family: s.family as ColourItem['family'],
    temperature: s.temperature as ColourItem['temperature'],
    depth: s.depth as ColourItem['depth'],
    intensity: s.intensity as ColourItem['intensity'],
    oklch: { l: s.oklch.l, c: s.oklch.c, h: s.oklch.h },
    source: s.source as ColourItem['source'],
    preference,
  };
}

export class ColourLibraryService {
  constructor(
    private readonly models: Models,
    private readonly appEnv: Config['APP_ENV'],
  ) {}

  private visibleStatuses(): ColourReviewStatus[] {
    return this.appEnv === 'production' ? ['approved'] : ['approved', 'draft'];
  }

  /** `monk-06-warm` from the user's skin tone (the middle of a Monk range) and undertone, or why there is none. */
  private async yourCategory(
    userId: UserId,
  ): Promise<{ categoryId: ColourCategoryId } | { missing: Exclude<MyColoursMissing, 'not_published'> }> {
    const appearance = await this.models.AppearanceProfile.findOne({ userId }).lean();
    if (appearance?.useInRecommendations === false) return { missing: 'signals_off' };
    const range = (appearance?.skinTone?.value as { monkRange?: string } | undefined)?.monkRange;
    const undertone = appearance?.undertone?.value as string | undefined;
    if (!range) return { missing: 'skin_tone' };
    if (!undertone || !(LIBRARY_UNDERTONE_IDS as readonly string[]).includes(undertone))
      return { missing: 'undertone' };
    const [from, to] = range.split('-').map(Number) as [number, number];
    return { categoryId: colourCategoryId(Math.round((from + to) / 2), undertone as LibraryUndertone) };
  }

  private async preferenceMap(userId: UserId): Promise<Map<string, ColourPreference>> {
    const doc = await this.models.UserColourPreference.findOne({ userId }).lean();
    return new Map((doc?.colours ?? []).map((c) => [c.colourId, c.preference as ColourPreference]));
  }

  private async swatches(colourIds: string[]): Promise<Map<string, SwatchDoc>> {
    const docs = (await this.models.ColourSwatch.find({
      colourId: { $in: colourIds },
    }).lean()) as unknown as SwatchDoc[];
    return new Map(docs.map((d) => [d.colourId, d]));
  }

  private summary(cat: CategoryDoc, swatches: Map<string, SwatchDoc>): ColourCategorySummary {
    return {
      categoryId: cat.categoryId as ColourCategoryId,
      monkTone: cat.monkTone,
      undertone: cat.undertone as LibraryUndertone,
      label: cat.label,
      colourCount: cat.colours.length,
      preview: cat.colours.slice(0, 3).flatMap((c) => {
        const s = swatches.get(c.colourId);
        return s ? [{ name: s.name, hex: s.hex }] : [];
      }),
    };
  }

  /** The user's own published category, or null. */
  private async ownCategory(userId: UserId): Promise<{ cat: CategoryDoc | null; missing: MyColoursMissing | null }> {
    const own = await this.yourCategory(userId);
    if ('missing' in own) return { cat: null, missing: own.missing };
    const cat = (await this.models.ColourCategory.findOne({
      categoryId: own.categoryId,
      reviewStatus: { $in: this.visibleStatuses() },
    }).lean()) as unknown as CategoryDoc | null;
    return { cat, missing: cat ? null : 'not_published' };
  }

  /** Only the user's own skin tone × undertone category: other categories are never served. */
  async mine(userId: UserId): Promise<MyColoursResponse> {
    const [{ cat, missing }, prefs] = await Promise.all([this.ownCategory(userId), this.preferenceMap(userId)]);
    const values = [...prefs.values()];
    const saved = {
      liked: values.filter((p) => p === 'liked').length,
      avoided: values.filter((p) => p === 'avoided').length,
    };
    if (!cat) return { missing, category: null, families: [], colours: [], saved };

    const swatches = await this.swatches(cat.colours.map((c) => c.colourId));
    const colours: CategoryColourItem[] = cat.colours.flatMap((c) => {
      const s = swatches.get(c.colourId);
      if (!s) return [];
      return [{ ...colourItem(s, prefs.get(c.colourId) ?? null), score: c.score, rank: c.rank, reasons: c.reasons }];
    });
    return {
      missing: null,
      category: {
        ...this.summary(cat, swatches),
        skinHex: cat.skinHex,
        rationale: cat.rationale,
        limitations: cat.limitations,
        reviewStatus: cat.reviewStatus as ColourReviewStatus,
      },
      families: COLOUR_FAMILIES.map((f) => ({
        id: f.id,
        label: f.label,
        count: colours.filter((c) => c.family === f.id).length,
      })).filter((f) => f.count > 0),
      colours,
      saved,
    };
  }

  // --- Coordinating colours and curated combinations (#105) ----------------------------------------------

  /**
   * Built from the user's own category, minus avoided colours, and stored. Rebuilt on read whenever the
   * category, its content version, the rules or the liked / avoided colours have changed since.
   */
  async combinations(userId: UserId): Promise<MyColourCombinationsResponse> {
    const [{ cat, missing }, prefs] = await Promise.all([this.ownCategory(userId), this.preferenceMap(userId)]);
    if (!cat) {
      return { missing, colours: [], harmonies: [], combinations: [], coordinating: [], generatedAt: null };
    }

    const swatches = await this.swatches(cat.colours.map((c) => c.colourId));
    const own = cat.colours.flatMap((c) => {
      const s = swatches.get(c.colourId);
      return s ? [{ entry: c, swatch: s, preference: prefs.get(c.colourId) ?? null }] : [];
    });
    const choices = own
      .filter((o) => o.preference)
      .map((o) => `${o.entry.colourId}:${o.preference}`)
      .sort();
    const inputsKey = createHash('sha256')
      .update([COMBINATION_RULES_VERSION, cat.categoryId, cat.contentVersion, cat.reviewStatus, ...choices].join('|'))
      .digest('hex');

    let stored = (await this.models.UserColourCombination.findOne({ userId }).lean()) as
      (GeneratedCombinations & { inputsKey: string; generatedAt: Date }) | null;
    if (stored?.inputsKey !== inputsKey) {
      const generated = generateCombinations(
        own.map((o) => ({
          colourId: o.entry.colourId,
          family: o.swatch.family,
          oklch: o.swatch.oklch,
          score: o.entry.score,
          preference: o.preference,
        })),
      );
      stored = { ...generated, inputsKey, generatedAt: new Date() };
      await this.models.UserColourCombination.updateOne(
        { userId },
        { $set: { ...stored, categoryId: cat.categoryId } },
        { upsert: true, runValidators: true },
      );
    }

    const visible = own.filter((o) => o.preference !== 'avoided');
    const byId = new Map(visible.map((o) => [o.entry.colourId, o]));
    const combinations = stored.combinations.flatMap((c) => {
      const colours = c.colours.flatMap((col) => {
        const o = byId.get(col.colourId);
        return o
          ? [
              {
                colourId: col.colourId,
                name: o.swatch.name,
                hex: o.swatch.hex,
                role: col.role as CombinationRole,
                preference: o.preference,
              },
            ]
          : [];
      });
      if (colours.length !== c.colours.length) return [];
      const harmony = c.harmony as CombinationHarmony;
      return [
        {
          combinationId: c.combinationId,
          harmony,
          colours,
          score: c.score,
          reason: COMBINATION_REASONS[harmony],
          likedCount: c.likedCount,
        },
      ];
    });
    return {
      missing: null,
      colours: visible.map((o) => ({
        colourId: o.entry.colourId,
        name: o.swatch.name,
        hex: o.swatch.hex,
        family: o.swatch.family as ColourItem['family'],
        preference: o.preference,
      })),
      harmonies: COMBINATION_HARMONIES.map((h) => ({
        id: h.id,
        label: h.label,
        count: combinations.filter((c) => c.harmony === h.id).length,
      })).filter((h) => h.count > 0),
      combinations,
      coordinating: stored.coordinating
        .filter((c) => byId.has(c.colourId))
        .map((c) => ({ colourId: c.colourId, matches: c.matches.filter((m) => byId.has(m)) })),
      generatedAt: stored.generatedAt.toISOString(),
    };
  }

  // --- Liked and avoided colours -------------------------------------------------------------------------

  async getPreferences(userId: UserId): Promise<ColourPreferencesResponse> {
    const doc = await this.models.UserColourPreference.findOne({ userId }).lean();
    const entries = [...(doc?.colours ?? [])].reverse(); // newest first
    const swatches = await this.swatches(entries.map((e) => e.colourId));
    const items = (preference: ColourPreference) =>
      entries.flatMap((e) => {
        const s = swatches.get(e.colourId);
        return e.preference === preference && s ? [colourItem(s, preference)] : [];
      });
    return {
      liked: items('liked'),
      avoided: items('avoided'),
      updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
    };
  }

  async updatePreferences(userId: UserId, body: UpdateColourPreferencesRequest): Promise<ColourPreferencesResponse> {
    const ids = [...new Set(body.colourIds)];
    const known = await this.models.ColourSwatch.countDocuments({ colourId: { $in: ids }, status: 'published' });
    if (known !== ids.length) throw new AppError('INVALID_REQUEST', 'Unknown colour');

    const existing = (await this.models.UserColourPreference.findOne({ userId }).lean())?.colours ?? [];
    // Only colours from the user's own category, or ones already saved (so they can be moved or cleared after
    // a change of skin tone or undertone).
    const { cat } = await this.ownCategory(userId);
    const allowed = new Set([...(cat?.colours.map((c) => c.colourId) ?? []), ...existing.map((c) => c.colourId)]);
    if (ids.some((id) => !allowed.has(id)))
      throw new AppError('INVALID_REQUEST', 'Choose colours from your own colour palette');

    const chosen = new Set(ids);
    const kept = existing
      .filter((c) => !chosen.has(c.colourId))
      .map((c) => ({ colourId: c.colourId, preference: c.preference, savedAt: c.savedAt }));
    const savedAt = new Date();
    const colours =
      body.preference === 'none'
        ? kept
        : [...kept, ...ids.map((colourId) => ({ colourId, preference: body.preference, savedAt }))];
    if (colours.length > COLOUR_LIBRARY_LIMITS.saved)
      throw new AppError(
        'INVALID_REQUEST',
        `You can keep up to ${COLOUR_LIBRARY_LIMITS.saved} liked and avoided colours`,
      );

    await this.models.UserColourPreference.updateOne(
      { userId },
      { $set: { colours } },
      { upsert: true, runValidators: true },
    );
    return this.getPreferences(userId);
  }
}
