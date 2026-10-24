import { Types } from 'mongoose';
import {
  bodyTypeProportion,
  heightBand,
  COLOR_IDS,
  type ColorId,
  FIT_IDS,
  SILHOUETTE_IDS,
  type AppearanceResponse,
  type Look,
  type ProfileResponse,
  type RecommendationRequest,
  type RecommendationResponse,
  type WarningCode,
} from '@styleme/contracts';
import type { Models } from '../models/index';
import type { AppearanceService } from './appearance.service';
import type { ColourLibraryService } from './colour-library.service';
import {
  AVOIDED_MAX_DISTANCE,
  LIKED_MAX_DISTANCE,
  generateLooks,
  nearestColour,
  signalsFromAppearance,
  toEngineDesign,
  vocabularyColours,
  type EngineSignals,
  type ProfileWithMeasurements,
  type StyleLibrary,
} from './engine';
import type { MeasurementsService } from './measurements.service';
import type { FeedbackService } from './feedback.service';
import type { OutfitImageService } from './outfit-image.service';
import type { ProfileService } from './profile.service';
import type { WordingService } from './wording.service';

// Looks for an occasion (FR-LOOK-01 … 17). The service does the I/O: it loads the user's profile and,
// only while `useInRecommendations` is on, their self-reported signals; runs the pure engine on the
// approved style library; optionally rewords explanations (AI wording, #55: off by default, never
// decides anything, falls back to the template text); and stores each look as a suggested `outfits`
// document. Nothing here is logged.

/** Suggested looks expire after 7 days unless saved (D-23, FR-LOOK-17). */
export const SUGGESTED_LOOK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface RecommendationResult {
  data: RecommendationResponse;
  warnings: WarningCode[];
}

export class RecommendationsService {
  constructor(
    private readonly models: Models,
    private readonly library: StyleLibrary,
    private readonly profiles: ProfileService,
    private readonly appearance: AppearanceService,
    private readonly wording: WordingService,
    private readonly feedback?: FeedbackService,
    private readonly now: () => Date = () => new Date(),
    private readonly images?: OutfitImageService,
    private readonly colours?: ColourLibraryService,
    private readonly measurements?: MeasurementsService,
  ) {}

  /**
   * The appearance signals, with the body proportions taken from the body type that the measurements in My
   * Profile identify (D-129) when they are complete; otherwise the self-reported proportions. Only while the
   * user allows appearance signals in recommendations (FR-SIG-03). Used by the engine only, never sent out.
   */
  private async signalsFor(userId: Types.ObjectId, appearance: AppearanceResponse): Promise<EngineSignals | null> {
    const signals = signalsFromAppearance(appearance);
    if (!appearance.useInRecommendations || !this.measurements) return signals;
    const { bodyTypeFromMeasurements } = await this.measurements.get(userId);
    const proportion = bodyTypeFromMeasurements ? bodyTypeProportion(bodyTypeFromMeasurements) : null;
    if (!proportion) return signals;
    return {
      undertone: signals?.undertone ?? null,
      skinTone: signals?.skinTone ?? null,
      bodyProportions: proportion,
    };
  }

  /**
   * Applies custom colours chosen specifically for this style to the profile.
   * Liked colours from My Colour Palette are strictly decoupled from Discover My Style recommendations,
   * so they are never automatically injected or used as filters for general look discovery.
   * If custom colours are chosen, outfits are generated strictly around those colours.
   */
  private async withPaletteColours(
    userId: Types.ObjectId,
    profile: ProfileResponse,
    customColors?: readonly string[],
  ): Promise<ProfileResponse> {
    if (customColors && customColors.length > 0) {
      let customVocab: ColorId[] = [];
      if (this.colours) {
        const mine = await this.colours.mine(userId);
        const nameMap = new Map(mine.colours.map((c) => [c.name.toLowerCase(), c.hex]));
        const hexList = customColors
          .map((c) => nameMap.get(c.toLowerCase()) ?? (c.startsWith('#') ? c : null))
          .filter(Boolean) as string[];
        if (hexList.length > 0) {
          customVocab = vocabularyColours(hexList, LIKED_MAX_DISTANCE);
          // If strict LIKED_MAX_DISTANCE filtered them, map each hex to nearest ColorId
          if (customVocab.length === 0) {
            customVocab = [...new Set(hexList.map((h) => nearestColour(h).colorId))];
          }
        }
      }
      // If still empty, check if any customColor matches a ColorId directly
      if (customVocab.length === 0) {
        const directMatches = customColors
          .map((c) => c.toLowerCase().replace(/\s+/g, '_'))
          .filter((c): c is ColorId => (COLOR_IDS as readonly string[]).includes(c));
        if (directMatches.length > 0) {
          customVocab = directMatches;
        }
      }
      return {
        ...profile,
        likedColors: (customVocab.length > 0 ? customVocab : profile.likedColors) as ProfileResponse['likedColors'],
      };
    }

    if (!this.colours) return profile;
    const [{ avoided }, mine] = await Promise.all([
      this.colours.getPreferences(userId),
      this.colours.mine(userId),
    ]);
    const disliked = [
      ...new Set([
        ...profile.dislikedColors,
        ...vocabularyColours(
          avoided.map((c) => c.hex),
          AVOIDED_MAX_DISTANCE,
        ),
      ]),
    ];
    // When custom colors are not chosen, outfits are generated strictly from the user's seasonal colour palette
    const sourceHexes = mine.colours.map((c) => c.hex);

    let paletteVocab =
      sourceHexes.length > 0
        ? vocabularyColours(sourceHexes, LIKED_MAX_DISTANCE)
        : [];
    if (paletteVocab.length === 0 && sourceHexes.length > 0) {
      paletteVocab = [...new Set(sourceHexes.map((h) => nearestColour(h).colorId))];
    }

    const likedColors = (
      paletteVocab.length > 0 ? paletteVocab : profile.likedColors
    ).filter((c) => !disliked.includes(c));
    return { ...profile, likedColors: likedColors as ProfileResponse['likedColors'], dislikedColors: disliked };
  }

  /** Softly applies the user's saved styling goals to recommendation rankings. */
  private async withStylingGoals(userId: Types.ObjectId, profile: ProfileResponse): Promise<ProfileResponse> {
    const prefs = await this.models.UserDesignPreference.findOne({ userId }).lean();
    if (!prefs || !prefs.stylingGoals || prefs.stylingGoals.length === 0) return profile;

    const extraSilhouettes: string[] = [];
    const updatedFits = { ...(profile.fitPreferences ?? { tops: null, bottoms: null, ethnicTops: null, ethnicSets: null }) };

    for (const goal of prefs.stylingGoals) {
      if (goal === 'define_waist') {
        extraSilhouettes.push('wrap', 'a_line', 'fitted');
        if (!updatedFits.tops) updatedFits.tops = 'slim';
      } else if (goal === 'longer_line') {
        extraSilhouettes.push('straight', 'wide_leg');
      } else if (goal === 'add_structure') {
        extraSilhouettes.push('a_line', 'fit_and_flare');
      } else if (goal === 'relaxed_comfort') {
        extraSilhouettes.push('straight');
        if (!updatedFits.tops) updatedFits.tops = 'regular';
      } else if (goal === 'taller_silhouette') {
        extraSilhouettes.push('straight', 'a_line');
      }
    }

    const silhouettePreferences = [...new Set([...(profile.silhouettePreferences ?? []), ...extraSilhouettes])].filter((s) =>
      (SILHOUETTE_IDS as readonly string[]).includes(s),
    );

    return {
      ...profile,
      silhouettePreferences: silhouettePreferences as ProfileResponse['silhouettePreferences'],
      fitPreferences: updatedFits,
    };
  }

  /** The user's own saved design for the requested garment, in engine terms; never features from the request. */
  private async designFor(userId: Types.ObjectId, request: RecommendationRequest) {
    if (!request.design) return null;
    const selection = await this.models.UserDesignSelection.findOne({
      userId,
      garmentType: request.design.garmentType,
      outfitCategory: request.design.outfitCategory,
    }).lean();
    return selection
      ? toEngineDesign(selection.garmentType, selection.selectedFeatures ?? {})
      : toEngineDesign(request.design.garmentType, {});
  }

  async recommend(userId: Types.ObjectId, request: RecommendationRequest): Promise<RecommendationResult> {
    const [profileBase, signals, feedbackSignals, design, measurements] = await Promise.all([
      this.profiles
        .get(userId)
        .then((p) => this.withPaletteColours(userId, p, request.customColors))
        .then((p) => this.withStylingGoals(userId, p)),
      this.appearance.get(userId).then((a) => this.signalsFor(userId, a)),
      this.feedback ? this.feedback.getSignals(userId) : Promise.resolve(null),
      this.designFor(userId, request),
      this.measurements ? this.measurements.get(userId) : Promise.resolve(null),
    ]);
    const profile: ProfileWithMeasurements = {
      ...profileBase,
      measurements:
        measurements?.valuesCm && Object.keys(measurements.valuesCm).length > 0
          ? {
              displayUnit: measurements.displayUnit,
              valuesCm: measurements.valuesCm as Record<string, number>,
            }
          : undefined,
    };
    const result = generateLooks({
      request,
      profile,
      signals,
      feedbackSignals,
      library: this.library,
      design,
    });

    // If an anarkali design was chosen, update slots and explanations to describe Anarkali
    const isAnarkali = request.design?.garmentType === 'anarkali';
    if (isAnarkali) {
      for (const look of result.looks) {
        for (const slot of look.slots) {
          if (slot.slot === 'top' || slot.slot === 'one_piece') {
            slot.searchPhrase = slot.searchPhrase.replace(/\b(kurti|kurta)\b/gi, 'flared anarkali suit');
            for (const alt of slot.alternatives) {
              alt.searchPhrase = alt.searchPhrase.replace(/\b(kurti|kurta)\b/gi, 'flared anarkali suit');
            }
          }
        }
      }
    }

    // Optional AI wording (FR-LOOK-16) runs after the deterministic result; a failure keeps the template text.
    const worded = await Promise.all(
      result.looks.map((look) => {
        if (isAnarkali) {
          const transformedExplanation = look.explanation.replace(/\b(kurti|kurta)\b/gi, 'anarkali suit');
          return this.wording.reword({ ...look, explanation: transformedExplanation }, request.occasion);
        }
        return this.wording.reword(look, request.occasion);
      }),
    );
    const warnings: WarningCode[] = [...result.warnings];
    if (worded.some((w) => w.skipped !== null)) warnings.push('AI_ENHANCEMENT_SKIPPED');

    const recommendationId = new Types.ObjectId();
    const expiresAt = new Date(this.now().getTime() + SUGGESTED_LOOK_TTL_MS);
    // What the looks were generated from, for regenerate (#49). Sizes are named by group only, and
    // appearance signals only as "used or not", never their values.
    const inputsUsed = {
      department: profile.department,
      departmentFiltered: result.departmentFiltered,
      likedColors: profile.likedColors,
      dislikedColors: profile.dislikedColors,
      contrastPreference: profile.contrastPreference,
      silhouettePreferences: profile.silhouettePreferences,
      fitPreferences: profile.fitPreferences,
      coveragePreferences: profile.coveragePreferences,
      fabricPreferences: profile.fabricPreferences,
      preferredStyles: profile.preferredStyles,
      sizesSaved: Object.entries(profile.sizes)
        .filter(([, size]) => size !== null)
        .map(([group]) => group),
      heightBand: heightBand(profile.department, profile.heightCm),
      signalsUsed: result.signalsUsed,
    };

    const docs = result.looks.map((look, i) => {
      let explanation = worded[i]!.explanation;
      if (isAnarkali) {
        explanation = explanation.replace(/\b(kurti|kurta)\b/gi, 'anarkali suit');
      }
      return {
        _id: new Types.ObjectId(),
        userId,
        recommendationId,
        status: 'suggested' as const,
        source: 'discover_my_style' as const,
        ...look,
        explanation,
        contentVersion: result.contentVersion,
        request,
        inputsUsed,
        defaultsApplied: result.defaultsApplied,
        conflicts: result.conflicts,
        warnings,
        aiModel: worded[i]!.aiModel,
        aiPromptVersion: worded[i]!.aiPromptVersion,
        expiresAt,
      };
    });
    if (docs.length > 0) await this.models.Outfit.insertMany(docs);

    const looks: Look[] = docs.map((doc) => ({
      id: String(doc._id),
      status: doc.status,
      templateId: doc.templateId,
      paletteId: doc.paletteId,
      slots: doc.slots,
      explanation: doc.explanation,
      explanationRefs: doc.explanationRefs,
      combinationSignature: doc.combinationSignature,
      aiModel: doc.aiModel,
      // A new look has no stored image yet; one is made on first view when outfit images are on.
      ...(this.images?.enabled ? { image: 'on_request' as const } : {}),
      ...(doc.designMatch ? { designMatch: doc.designMatch } : {}),
      source: doc.source,
    }));
    return {
      data: {
        recommendationId: String(recommendationId),
        looks,
        defaultsApplied: result.defaultsApplied,
        conflicts: result.conflicts,
        ...(result.limitedBy ? { limitedBy: result.limitedBy } : {}),
      },
      warnings,
    };
  }
}
