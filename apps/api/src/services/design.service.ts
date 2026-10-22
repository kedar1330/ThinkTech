import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  DESIGN_FEATURE_CATEGORIES,
  OUTFIT_CATEGORIES,
  heightBand,
  type ClothingPreference,
  type DesignFeatureCategory,
  type DesignFeatureCategoryResult,
  type DesignFeatureItem,
  type DesignFeaturesQuery,
  type DesignFeaturesResponse,
  type DesignImage,
  type DesignPreferencesResponse,
  type DesignSelectionItem,
  type DesignTaxonomyResponse,
  type FeaturePreference,
  type GarmentKind,
  type GarmentTypeItem,
  type OutfitCategory,
  type SaveDesignSelectionRequest,
  type SuitabilityResult,
  type UpdateDesignPreferencesRequest,
} from '@styleme/contracts';
import { baseFigureAssetId } from '../design/illustrations';
import { evaluateSuitability, type MatchableRule } from '../design/rules';
import type { Models } from '../models/index';
import { AppError } from '../utils/errors';

// Design features (D-132, API.md §3.12). Everything follows the user's Clothing Preference: Women's Wear
// sees only women's garments and features, Men's Wear only men's; "any" lets the page choose. Which features
// are shown comes from the founder-approved suitability rules, matched against the body type (when the user
// allows appearance signals), the height band (never the height) and the user's styling goals. Without an
// approved rule for a category, every feature in it is shown unranked, and the response says so.

type UserId = Types.ObjectId;

interface GarmentNode {
  key: string;
  name: string;
  garmentKind: GarmentKind | null;
  departments: string[];
  outfitCategories: string[];
  featureCategoryIds: string[];
}

const RESULT_RANK: Record<SuitabilityResult | 'none', number> = {
  recommended: 0,
  alternative: 1,
  none: 2,
  not_preferred: 3,
};

function garmentItem(node: GarmentNode): GarmentTypeItem {
  return {
    id: node.key.replace(/^garment-/, ''),
    name: node.name,
    kind: node.garmentKind as GarmentKind,
    outfitCategories: node.outfitCategories as OutfitCategory[],
    featureCategories: node.featureCategoryIds as DesignFeatureCategory[],
  };
}

export class DesignService {
  constructor(private readonly models: Models) {}

  /** The Clothing Preference to use: the profile's, or the requested one when the profile allows both. */
  private async department(userId: UserId, requested?: ClothingPreference) {
    const profile = await this.models.Profile.findOne({ userId }).lean();
    const fromProfile = profile?.department === 'women' || profile?.department === 'men' ? profile.department : null;
    return {
      department: (fromProfile ?? requested ?? null) as ClothingPreference | null,
      canSwitch: fromProfile === null,
      heightCm: profile?.heightCm ?? null,
    };
  }

  private async requireDepartment(userId: UserId, requested?: ClothingPreference) {
    const resolved = await this.department(userId, requested);
    if (!resolved.department) throw new AppError('INVALID_REQUEST', 'Choose Women’s Wear or Men’s Wear first');
    return { ...resolved, department: resolved.department };
  }

  private async garment(department: ClothingPreference, garmentType: string): Promise<GarmentNode> {
    const node = await this.models.OutfitCategory.findOne({
      key: `garment-${garmentType}`,
      level: 'garment_type',
      departments: department,
      status: 'published',
    }).lean();
    if (!node) throw new AppError('NOT_FOUND', 'Garment type not found');
    return node as unknown as GarmentNode;
  }

  async taxonomy(userId: UserId, requested?: ClothingPreference): Promise<DesignTaxonomyResponse> {
    const { department, canSwitch } = await this.department(userId, requested);
    const filter: Record<string, unknown> = { level: 'garment_type', status: 'published' };
    if (department) filter.departments = department;
    const garments = (await this.models.OutfitCategory.find(filter)
      .sort({ sortOrder: 1 })
      .lean()) as unknown as GarmentNode[];
    return {
      department,
      canSwitchDepartment: canSwitch,
      outfitCategories: OUTFIT_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        garmentTypes: garments.filter((g) => g.outfitCategories.includes(c.id)).map(garmentItem),
      })),
    };
  }

  private async images(assetIds: string[]): Promise<Map<string, DesignImage>> {
    const docs = await this.models.Illustration.find({ assetId: { $in: assetIds }, status: 'published' }).lean();
    return new Map(
      docs.map((d) => [d.assetId, { assetId: d.assetId, url: d.views[0]?.path ?? '', alt: d.altText }] as const),
    );
  }

  async features(userId: UserId, query: DesignFeaturesQuery): Promise<DesignFeaturesResponse> {
    const { department, heightCm } = await this.requireDepartment(userId, query.department);
    const garment = await this.garment(department, query.garmentType);
    const kind = garment.garmentKind as GarmentKind;
    const categoryIds = garment.featureCategoryIds;
    const featureFilter: Record<string, unknown> = {
      departments: department,
      featureCategory: { $in: categoryIds },
      status: 'published',
      selectable: true,
      $or: [{ garmentKinds: { $size: 0 } }, { garmentKinds: kind }],
    };
    const ruleFilter: Record<string, unknown> = {
      status: 'active',
      reviewStatus: 'approved',
      featureCategory: { $in: categoryIds },
    };

    const [features, rules, appearance, prefs, selection, combinations] = await Promise.all([
      this.models.DesignFeature.find(featureFilter).sort({ sortOrder: 1 }).lean(),
      this.models.FeatureSuitabilityRule.find(ruleFilter).lean(),
      this.models.AppearanceProfile.findOne({ userId }).lean(),
      this.models.UserDesignPreference.findOne({ userId }).lean(),
      this.models.UserDesignSelection.findOne({
        userId,
        clothingPreference: department,
        garmentType: query.garmentType,
      }).lean(),
      this.models.FeatureCombination.find({ kind: 'incompatible', status: 'published' }).lean(),
    ]);

    // Appearance signals are used only while the user allows it (FR-SIG); the height band is profile data.
    const bodyType =
      appearance?.useInRecommendations !== false ? ((appearance?.bodyType?.value as string | undefined) ?? null) : null;
    const band = heightBand(department, heightCm);
    const goals = prefs?.stylingGoals ?? [];
    const suitability = evaluateSuitability(rules as unknown as MatchableRule[], {
      department,
      garmentKind: kind,
      bodyType,
      heightBand: band,
      stylingGoals: goals,
    });
    const preference = new Map(
      (prefs?.featurePreferences ?? []).map((p) => [p.featureId, p.preference as FeaturePreference]),
    );

    const assetIds = [baseFigureAssetId(department)];
    for (const f of features)
      for (const i of f.illustrations) if (i.department === department) assetIds.push(i.assetId);
    const images = await this.images(assetIds);
    const imageFor = (f: (typeof features)[number], role: 'card' | 'layer') => {
      const ref = f.illustrations.find((i) => i.department === department && i.role === role);
      return ref ? (images.get(ref.assetId) ?? null) : null;
    };

    const categories: DesignFeatureCategoryResult[] = [];
    for (const meta of DESIGN_FEATURE_CATEGORIES) {
      if (!categoryIds.includes(meta.id)) continue;
      const items: DesignFeatureItem[] = features
        .filter((f) => f.featureCategory === meta.id)
        .map((f) => {
          const s = suitability.get(f.featureId);
          return {
            featureId: f.featureId,
            name: f.name,
            description: f.description,
            category: meta.id,
            image: imageFor(f, 'card'),
            layer: imageFor(f, 'layer'),
            suitability: s ? { result: s.result, reasons: s.reasons } : null,
            preference: preference.get(f.featureId) ?? null,
          };
        });
      if (items.length === 0) continue;
      const personalised = items.some((i) => i.suitability !== null);
      const shown =
        query.view === 'suits' && personalised
          ? items.filter(
              (i) =>
                i.preference !== 'disliked' &&
                (i.preference === 'liked' ||
                  i.suitability?.result === 'recommended' ||
                  i.suitability?.result === 'alternative'),
            )
          : query.view === 'suits'
            ? items.filter((i) => i.preference !== 'disliked')
            : items;
      // Stable sort: suitability first, then the catalogue order.
      shown.sort((a, b) => RESULT_RANK[a.suitability?.result ?? 'none'] - RESULT_RANK[b.suitability?.result ?? 'none']);
      categories.push({
        id: meta.id,
        label: meta.label,
        presentation: meta.presentation,
        personalised,
        features: shown,
      });
    }

    await this.storeSnapshot(
      userId,
      department,
      query.garmentType,
      kind,
      { bodyType, band, goals },
      suitability,
      features,
    );

    const shownIds = new Set(features.map((f) => f.featureId));
    const incompatible = combinations
      .filter((c) => c.featureIds.every((id) => shownIds.has(id)))
      .map((c) => [c.featureIds[0]!, c.featureIds[1]!] as [string, string]);

    return {
      department,
      garmentType: garmentItem(garment),
      view: query.view,
      basis: { bodyType: bodyType !== null, heightBand: band, stylingGoals: goals.length },
      baseFigure: images.get(baseFigureAssetId(department)) ?? null,
      categories,
      incompatible,
      selection: selection ? this.selectionItem(selection) : null,
    };
  }

  /**
   * Stores the personalised result for this garment type in the user's design preferences, so it can be
   * reused and audited. Only feature and rule IDs are kept; `basisKey` is a hash of the inputs (never the
   * inputs themselves), and the snapshot is rewritten only when it changes.
   */
  private async storeSnapshot(
    userId: UserId,
    department: ClothingPreference,
    garmentType: string,
    kind: GarmentKind,
    basis: { bodyType: string | null; band: string | null; goals: string[] },
    suitability: ReturnType<typeof evaluateSuitability>,
    features: Array<{ featureId: string; featureCategory: string }>,
  ): Promise<void> {
    const entries = features
      .filter((f) => suitability.has(f.featureId))
      .map((f) => {
        const s = suitability.get(f.featureId)!;
        return { featureId: f.featureId, featureCategory: f.featureCategory, result: s.result, ruleIds: s.ruleIds };
      });
    const basisKey = createHash('sha256')
      .update(JSON.stringify({ department, kind, ...basis, goals: [...basis.goals].sort(), entries }))
      .digest('hex');
    const current = await this.models.UserDesignPreference.findOne(
      { userId, personalised: { $elemMatch: { garmentType, department, basisKey } } },
      { _id: 1 },
    ).lean();
    if (current) return;
    await this.models.UserDesignPreference.updateOne(
      { userId },
      { $pull: { personalised: { garmentType, department } }, $setOnInsert: { clothingPreference: department } },
      { upsert: true },
    );
    await this.models.UserDesignPreference.updateOne(
      { userId },
      { $push: { personalised: { garmentType, department, basisKey, computedAt: new Date(), features: entries } } },
    );
  }

  // --- Preferences ---------------------------------------------------------------------------------------

  async getPreferences(userId: UserId): Promise<DesignPreferencesResponse> {
    const doc = await this.models.UserDesignPreference.findOne({ userId }).lean();
    return {
      department: (doc?.clothingPreference as ClothingPreference | null) ?? null,
      featurePreferences: (doc?.featurePreferences ?? []).map((p) => ({
        featureId: p.featureId,
        featureCategory: p.featureCategory,
        preference: p.preference as FeaturePreference,
      })),
      stylingGoals: doc?.stylingGoals ?? [],
      fitPreferences: doc?.fitPreferences ?? [],
      occasionPreferences: doc?.occasionPreferences ?? [],
      updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null,
    };
  }

  private async knownFeatures(ids: string[]) {
    const unique = [...new Set(ids)];
    const docs = await this.models.DesignFeature.find({ featureId: { $in: unique }, status: 'published' }).lean();
    if (docs.length !== unique.length) throw new AppError('INVALID_REQUEST', 'Unknown design feature');
    return new Map(docs.map((d) => [d.featureId, d]));
  }

  async updatePreferences(userId: UserId, body: UpdateDesignPreferencesRequest): Promise<DesignPreferencesResponse> {
    const { department } = await this.department(userId);
    const set: Record<string, unknown> = {};
    if (body.featurePreferences) {
      const known = await this.knownFeatures(body.featurePreferences.map((p) => p.featureId));
      const existing = (await this.models.UserDesignPreference.findOne({ userId }).lean())?.featurePreferences ?? [];
      type Entry = { featureId: string; featureCategory: string; preference: string };
      const merged = new Map<string, Entry>(
        existing.map((p) => [
          p.featureId,
          { featureId: p.featureId, featureCategory: p.featureCategory, preference: p.preference },
        ]),
      );
      for (const p of body.featurePreferences) {
        if (p.preference === 'no_preference') merged.delete(p.featureId);
        else
          merged.set(p.featureId, {
            featureId: p.featureId,
            featureCategory: known.get(p.featureId)!.featureCategory,
            preference: p.preference,
          });
      }
      set.featurePreferences = [...merged.values()];
    }
    if (body.stylingGoals) set.stylingGoals = [...new Set(body.stylingGoals)];
    for (const [field, category] of [
      ['fitPreferences', 'fit'],
      ['occasionPreferences', 'occasion'],
    ] as const) {
      const ids = body[field];
      if (!ids) continue;
      const known = await this.knownFeatures(ids);
      if ([...known.values()].some((f) => f.featureCategory !== category))
        throw new AppError('INVALID_REQUEST', `Only ${category} features belong in ${field}`);
      set[field] = [...known.keys()];
    }
    if (department) set.clothingPreference = department;
    await this.models.UserDesignPreference.updateOne({ userId }, { $set: set }, { upsert: true, runValidators: true });
    return this.getPreferences(userId);
  }

  // --- Selections ----------------------------------------------------------------------------------------

  private selectionItem(doc: {
    garmentType: string;
    outfitCategory: string;
    clothingPreference: string;
    selectedFeatures?: unknown;
    customization?: {
      necklineDepth?: string | null;
      sleeveLength?: string | null;
      otherSelectedAttributes?: unknown;
    } | null;
    savedAt: Date;
  }): DesignSelectionItem {
    const asObject = (m: unknown) => (m && typeof m === 'object' ? (m as Record<string, string>) : undefined);
    const c = doc.customization ?? {};
    const other = asObject(c.otherSelectedAttributes);
    return {
      garmentType: doc.garmentType,
      outfitCategory: doc.outfitCategory as OutfitCategory,
      department: doc.clothingPreference as ClothingPreference,
      selectedFeatures: asObject(doc.selectedFeatures) ?? {},
      customization: {
        ...(c.necklineDepth ? { necklineDepth: c.necklineDepth as 'shallow' } : {}),
        ...(c.sleeveLength ? { sleeveLength: c.sleeveLength as 'full' } : {}),
        ...(other && Object.keys(other).length > 0 ? { otherSelectedAttributes: other } : {}),
      },
      savedAt: doc.savedAt.toISOString(),
    };
  }

  async listSelections(userId: UserId): Promise<DesignSelectionItem[]> {
    const docs = await this.models.UserDesignSelection.find({ userId }).sort({ savedAt: -1 }).lean();
    return docs.map((d) => this.selectionItem(d));
  }

  async saveSelection(userId: UserId, body: SaveDesignSelectionRequest): Promise<DesignSelectionItem> {
    const { department } = await this.requireDepartment(userId, body.department);
    const garment = await this.garment(department, body.garmentType);
    if (!garment.outfitCategories.includes(body.outfitCategory))
      throw new AppError('INVALID_REQUEST', 'This garment is not in that outfit category');

    const chosen = Object.entries(body.selectedFeatures) as Array<[DesignFeatureCategory, string]>;
    const known = await this.knownFeatures(chosen.map(([, id]) => id));
    for (const [category, featureId] of chosen) {
      const f = known.get(featureId)!;
      const fits =
        f.featureCategory === category &&
        f.selectable &&
        f.departments.includes(department) &&
        garment.featureCategoryIds.includes(category) &&
        (f.garmentKinds.length === 0 || f.garmentKinds.includes(garment.garmentKind as GarmentKind));
      if (!fits) throw new AppError('INVALID_REQUEST', 'A selected feature does not apply to this garment');
    }
    const ids = chosen.map(([, id]) => id);
    const pairs = await this.models.FeatureCombination.find({
      kind: 'incompatible',
      status: 'published',
      featureIds: { $in: ids },
    }).lean();
    if (pairs.some((p) => p.featureIds.every((id) => ids.includes(id))))
      throw new AppError('INVALID_REQUEST', 'These features cannot be made together');

    const savedAt = new Date();
    const doc = await this.models.UserDesignSelection.findOneAndUpdate(
      { userId, clothingPreference: department, garmentType: body.garmentType },
      {
        $set: {
          outfitCategory: body.outfitCategory,
          selectedFeatures: body.selectedFeatures,
          customization: body.customization,
          savedAt,
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();
    return this.selectionItem(doc!);
  }

  async deleteSelection(userId: UserId, garmentType: string, requested?: ClothingPreference): Promise<void> {
    const { department } = await this.requireDepartment(userId, requested);
    await this.models.UserDesignSelection.deleteOne({ userId, clothingPreference: department, garmentType });
  }
}
