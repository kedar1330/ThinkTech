import { Types } from 'mongoose';
import type { Look, RecommendationRequest, RecommendationResponse, WarningCode } from '@styleme/contracts';
import type { Models } from '../models/index';
import type { AppearanceService } from './appearance.service';
import { generateLooks, signalsFromAppearance, type StyleLibrary } from './engine';
import type { ProfileService } from './profile.service';

// Looks for an occasion (FR-LOOK-01 … 17). The service does the I/O: it loads the user's profile and,
// only while `useInRecommendations` is on, their self-reported signals; runs the pure engine on the
// approved style library; and stores each look as a suggested `outfits` document. No external AI is
// called (optional AI wording is #55), and nothing here is logged.

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
    private readonly now: () => Date = () => new Date(),
  ) {}

  async recommend(userId: Types.ObjectId, request: RecommendationRequest): Promise<RecommendationResult> {
    const [profile, appearance] = await Promise.all([this.profiles.get(userId), this.appearance.get(userId)]);
    const result = generateLooks({
      request,
      profile,
      signals: signalsFromAppearance(appearance),
      library: this.library,
    });

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
      signalsUsed: result.signalsUsed,
    };

    const docs = result.looks.map((look) => ({
      _id: new Types.ObjectId(),
      userId,
      recommendationId,
      status: 'suggested' as const,
      ...look,
      contentVersion: result.contentVersion,
      request,
      inputsUsed,
      defaultsApplied: result.defaultsApplied,
      conflicts: result.conflicts,
      warnings: result.warnings,
      aiModel: null,
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
      aiModel: null,
    }));
    return {
      data: {
        recommendationId: String(recommendationId),
        looks,
        defaultsApplied: result.defaultsApplied,
        conflicts: result.conflicts,
        ...(result.limitedBy ? { limitedBy: result.limitedBy } : {}),
      },
      warnings: result.warnings,
    };
  }
}
