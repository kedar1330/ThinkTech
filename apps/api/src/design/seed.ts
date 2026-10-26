import { DESIGN_FEATURE_CATEGORIES, OUTFIT_CATEGORIES } from '@styleme/contracts';
import type { Models } from '../models/index';
import approvedRuleFile from '../style-rules/data/feature-suitability-rules.json' with { type: 'json' };
import { DESIGN_FEATURES, GARMENT_TYPES, INCOMPATIBLE_PAIRS } from './catalogue';
import { designIllustrations } from './illustrations';
import { suitabilityRuleFileSchema, type SuitabilityRuleRecord } from './rules';

// Upserts the design-feature catalogue (D-132) into MongoDB. Safe to re-run: every record is matched by its
// stable key. Only founder-approved suitability rules become `active`; rules no longer in the approved file
// are switched off, never deleted, so the IDs stored in user snapshots stay resolvable.

/** The approved rules shipped with the API (validated; an invalid file fails loudly). */
export function approvedSuitabilityRules(): SuitabilityRuleRecord[] {
  const file = suitabilityRuleFileSchema.parse(approvedRuleFile);
  const unapproved = file.rules.filter((r) => r.reviewStatus !== 'approved').map((r) => r.ruleId);
  if (unapproved.length > 0) throw new Error(`Unapproved rules in the shipped file: ${unapproved.join(', ')}`);
  return file.rules;
}

export interface DesignSeedResult {
  outfitCategories: number;
  featureCategories: number;
  features: number;
  illustrations: number;
  combinations: number;
  activeRules: number;
}

export async function seedDesignCatalogue(
  models: Models,
  options: { rules?: SuitabilityRuleRecord[] } = {},
): Promise<DesignSeedResult> {
  const now = new Date();
  const upsert = { upsert: true, runValidators: true } as const;

  // Hierarchy: departments → outfit categories → garment types.
  const nodes = [
    { key: 'women', level: 'department', name: 'Women’s Wear', departments: ['women'], sortOrder: 1 },
    { key: 'men', level: 'department', name: 'Men’s Wear', departments: ['men'], sortOrder: 2 },
    ...OUTFIT_CATEGORIES.map((c, i) => ({
      key: `outfit-${c.id}`,
      level: 'outfit_category',
      name: c.label,
      departments: ['women', 'men'],
      outfitCategories: [c.id],
      sortOrder: i + 1,
    })),
    ...GARMENT_TYPES.map((g, i) => ({
      key: `garment-${g.id}`,
      level: 'garment_type',
      name: g.name,
      departments: g.departments,
      outfitCategories: g.outfitCategories,
      garmentKind: g.kind,
      featureCategoryIds: DESIGN_FEATURE_CATEGORIES.filter((c) => (c.kinds as readonly string[]).includes(g.kind)).map(
        (c) => c.id,
      ),
      sortOrder: i + 1,
    })),
  ];
  for (const node of nodes) {
    await models.OutfitCategory.updateOne({ key: node.key }, { $set: { ...node, status: 'published' } }, upsert);
  }

  for (const [i, c] of DESIGN_FEATURE_CATEGORIES.entries()) {
    await models.DesignFeatureCategory.updateOne(
      { categoryId: c.id },
      {
        $set: {
          label: c.label,
          presentation: c.presentation,
          garmentKinds: c.kinds,
          sortOrder: i + 1,
          status: 'published',
        },
      },
      upsert,
    );
  }

  // Images first, so every feature can point at its assets by ID.
  const images = designIllustrations();
  for (const img of images) {
    await models.Illustration.updateOne(
      { assetId: img.assetId },
      {
        $set: {
          kind: img.kind,
          title: img.title,
          altText: img.altText,
          views: [{ view: 'front', storage: 'static', path: img.path, format: 'svg', width: 200, height: 240 }],
          depicts: { departments: [img.department], clothingStyleIds: [], bodyShape: null, skinToneRange: null },
          figureClothing: null,
          rights: {
            source: 'code_generated',
            creator: 'StyleMe',
            licence: 'StyleMe proprietary',
            allowedUsage: ['outfit_categories'],
            verifiedAt: now,
          },
          status: 'published',
          review: { status: 'approved', approvedBy: null, approvedAt: now },
          publishedAt: now,
        },
      },
      upsert,
    );
  }

  // Design pictures the generator no longer makes (e.g. back necklines, #163) are archived, so no
  // database keeps serving a path whose file doesn't exist.
  await models.Illustration.updateMany(
    {
      kind: { $in: ['design_feature', 'design_feature_layer'] },
      assetId: { $nin: images.map((img) => img.assetId) },
      status: 'published',
    },
    { $set: { status: 'archived' } },
  );

  for (const [i, f] of DESIGN_FEATURES.entries()) {
    const illustrations = images
      .filter((img) => img.featureId === f.featureId)
      .map((img) => ({ department: img.department, role: img.layer ? 'layer' : 'card', assetId: img.assetId }));
    await models.DesignFeature.updateOne(
      { featureId: f.featureId },
      {
        $set: {
          slug: f.featureId.slice(f.category.length + 1).replace(/_/g, '-'),
          name: f.name,
          description: f.description,
          featureCategory: f.category,
          departments: f.departments,
          garmentKinds: f.kinds ?? [],
          attributes: f.attributes,
          illustrations,
          selectable: f.selectable !== false,
          sortOrder: i + 1,
          status: 'published',
        },
      },
      upsert,
    );
  }

  for (const [a, b, reason] of INCOMPATIBLE_PAIRS) {
    await models.FeatureCombination.updateOne(
      { pairKey: [a, b].sort().join('+'), kind: 'incompatible' },
      { $set: { featureIds: [a, b], reason, status: 'published' } },
      upsert,
    );
  }

  const rules = options.rules ?? approvedSuitabilityRules();
  const known = new Set(DESIGN_FEATURES.map((f) => f.featureId));
  for (const rule of rules) {
    if (!known.has(rule.featureId)) throw new Error(`Rule ${rule.ruleId} names an unknown feature`);
    await models.FeatureSuitabilityRule.updateOne(
      { ruleId: rule.ruleId },
      {
        $set: {
          ...rule,
          featureCategory: DESIGN_FEATURES.find((f) => f.featureId === rule.featureId)!.category,
          reviewedAt: rule.reviewedAt ? new Date(rule.reviewedAt) : null,
          status: rule.reviewStatus === 'approved' ? 'active' : 'inactive',
        },
      },
      upsert,
    );
  }
  await models.FeatureSuitabilityRule.updateMany(
    { ruleId: { $nin: rules.map((r) => r.ruleId) }, status: 'active' },
    { $set: { status: 'inactive' } },
  );

  return {
    outfitCategories: nodes.length,
    featureCategories: DESIGN_FEATURE_CATEGORIES.length,
    features: DESIGN_FEATURES.length,
    illustrations: images.length,
    combinations: INCOMPATIBLE_PAIRS.length,
    activeRules: rules.filter((r) => r.reviewStatus === 'approved').length,
  };
}
