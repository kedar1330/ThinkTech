import { Types } from 'mongoose';
import {
  bodyTypeProportion,
  heightBand,
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
  signalsFromAppearance,
  toEngineDesign,
  vocabularyColours,
  type EngineSignals,
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
   * The profile with the colours liked and avoided in My Colour Palette (D-133) added, as their nearest look
   * colours: liked ones are preferred, avoided ones are left out only when they are near-identical. A colour
   * that ends up both liked and avoided is avoided (FR-LOOK-10).
   */
  private async withPaletteColours(userId: Types.ObjectId, profile: ProfileResponse): Promise<ProfileResponse> {
    if (!this.colours) return profile;
    const { liked, avoided } = await this.colours.getPreferences(userId);
    if (liked.length === 0 && avoided.length === 0) return profile;
    const disliked = [
      ...new Set([
        ...profile.dislikedColors,
        ...vocabularyColours(
          avoided.map((c) => c.hex),
          AVOIDED_MAX_DISTANCE,
        ),
      ]),
    ];
    const likedColors = [
      ...new Set([
        ...profile.likedColors,
        ...vocabularyColours(
          liked.map((c) => c.hex),
          LIKED_MAX_DISTANCE,
        ),
      ]),
    ].filter((c) => !disliked.includes(c));
    return { ...profile, likedColors, dislikedColors: disliked };
  }

  /** The user's own saved design for the requested garment, in engine terms; never features from the request. */
  private async designFor(userId: Types.ObjectId, request: RecommendationRequest) {
    if (!request.design) return null;
    const selection = await this.models.UserDesignSelection.findOne({
      userId,
      garmentType: request.design.garmentType,
      outfitCategory: request.design.outfitCategory,
    }).lean();
    return selection ? toEngineDesign(selection.garmentType, selection.selectedFeatures ?? {}) : null;
  }

  async recommend(userId: Types.ObjectId, request: RecommendationRequest): Promise<RecommendationResult> {
    const [profile, signals, feedbackSignals, design] = await Promise.all([
      this.profiles.get(userId).then((p) => this.withPaletteColours(userId, p)),
      this.appearance.get(userId).then((a) => this.signalsFor(userId, a)),
      this.feedback ? this.feedback.getSignals(userId) : Promise.resolve(null),
      this.designFor(userId, request),
    ]);
    const result = generateLooks({
      request,
      profile,
      signals,
      feedbackSignals,
      library: this.library,
      design,
    });

    // Optional AI wording (FR-LOOK-16) runs after the deterministic result; a failure keeps the template text.
    const worded = await Promise.all(result.looks.map((look) => this.wording.reword(look, request.occasion)));
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

    const docs = result.looks.map((look, i) => ({
      _id: new Types.ObjectId(),
      userId,
      recommendationId,
      status: 'suggested' as const,
      ...look,
      explanation: worded[i]!.explanation,
      contentVersion: result.contentVersion,
      request,
      inputsUsed,
      defaultsApplied: result.defaultsApplied,
      conflicts: result.conflicts,
      warnings,
      aiModel: worded[i]!.aiModel,
      aiPromptVersion: worded[i]!.aiPromptVersion,
      expiresAt,
    }));
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
