import type { Model } from 'mongoose';
import type { Models } from '../models/index';
import {
  lintLibrary,
  type FabricRule,
  type Palette,
  type RawLibrary,
  type StyleRecord,
  type StylingRule,
  type Template,
} from '../style-rules';

// Catalogue import (TD-FS-CAT-01, D-110, T-80): loads the style-rules files into the shared MongoDB
// collections by record ID and version, validated by the same Zod schemas and linter as the runtime.
//
// - Approved records are published; draft and reviewed records (only with `includeDrafts`) are stored as
//   drafts and are never published (D-62); retired records are archived.
// - Idempotent: a record whose stored version is the same or newer is left unchanged.
// - A published record is never replaced by an unapproved one, even with a higher version.

export interface ImportOptions {
  /** Also store draft and reviewed records (as `status: draft`), e.g. for local review. */
  includeDrafts?: boolean;
  /** Test fixture libraries only; the import script never sets it. */
  allowFixtures?: boolean;
}

export interface ImportCounts {
  created: number;
  updated: number;
  unchanged: number;
  /** Skipped because a published record would have been replaced by an unapproved one. */
  keptPublished: number;
}

export type ImportResult = Record<'palettes' | 'templates' | 'stylingRules' | 'fabricRules', ImportCounts>;

export class CatalogueImportError extends Error {
  constructor(readonly issues: { recordId: string; code: string }[]) {
    super(
      `Style-rules files failed validation with ${issues.length} issue(s): ` +
        issues
          .slice(0, 5)
          .map((i) => `${i.recordId} ${i.code}`)
          .join('; ') +
        (issues.length > 5 ? '; …' : ''),
    );
    this.name = 'CatalogueImportError';
  }
}

const unique = <T>(values: T[]) => [...new Set(values)];

function lifecycle(record: StyleRecord) {
  const reviewedAt = record.reviewedAt ? new Date(record.reviewedAt) : null;
  switch (record.reviewStatus) {
    case 'approved':
      return {
        status: 'published',
        review: { status: 'approved', approvedBy: null, approvedAt: reviewedAt },
        publishedAt: reviewedAt ?? new Date(),
        archivedAt: null,
      };
    case 'retired':
      return {
        status: 'archived',
        review: { status: reviewedAt ? 'approved' : 'draft', approvedBy: null, approvedAt: reviewedAt },
        publishedAt: null,
        archivedAt: new Date(),
      };
    default:
      return {
        status: 'draft',
        review: { status: record.reviewStatus, approvedBy: null, approvedAt: null },
        publishedAt: null,
        archivedAt: null,
      };
  }
}

function effectAttributes(rule: StylingRule | FabricRule) {
  return unique([...rule.effect.prefer, ...rule.effect.deprioritise].map((ref) => ref.attribute));
}

const toDocument = {
  palette: (p: Palette) => ({
    name: p.name,
    facets: {
      colorIds: unique([...p.neutrals, ...p.accents, ...p.combinations.flatMap((c) => c.colors)]),
      undertoneAffinity: p.undertoneAffinity,
      occasions: p.occasions,
    },
  }),
  template: (t: Template) => ({
    name: t.name,
    facets: {
      department: t.department,
      occasions: t.occasions,
      styles: t.styles,
      garmentTypes: unique(t.slots.flatMap((s) => s.categoryOptions)),
    },
  }),
  stylingRule: (r: StylingRule) => ({
    name: r.id,
    facets: { type: r.type, attributeIds: effectAttributes(r) },
  }),
  fabricRule: (r: FabricRule) => ({ name: r.id, facets: { fabric: r.fabric } }),
};

async function upsert<R extends StyleRecord>(
  model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any -- four record models share this path
  records: R[],
  describe: (record: R) => { name: string; facets: Record<string, unknown> },
): Promise<ImportCounts> {
  const counts: ImportCounts = { created: 0, updated: 0, unchanged: 0, keptPublished: 0 };
  for (const record of records) {
    const existing = await model.findOne({ recordId: record.id });
    const fields = {
      recordId: record.id,
      ...describe(record),
      record,
      tags: record.tags,
      version: record.version,
      ...lifecycle(record),
    };
    if (!existing) {
      await model.create(fields);
      counts.created += 1;
    } else if (existing.get('version') >= record.version) {
      counts.unchanged += 1;
    } else if (existing.get('status') === 'published' && record.reviewStatus !== 'approved') {
      counts.keptPublished += 1;
    } else {
      existing.set(fields);
      await existing.save();
      counts.updated += 1;
    }
  }
  return counts;
}

/**
 * Imports a style library into the catalogue collections. Throws CatalogueImportError, and writes
 * nothing, when any record fails the schema or linter (an unapproved record is only an issue without
 * `includeDrafts`, and then it is simply not imported).
 */
export async function importStyleLibrary(
  models: Models,
  raw: RawLibrary,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const lint = lintLibrary(raw, { allowFixtures: options.allowFixtures });
  const blocking = lint.issues.filter((i) => i.code !== 'NOT_APPROVED');
  if (blocking.length > 0) throw new CatalogueImportError(blocking);

  const set = options.includeDrafts ? lint.valid : lint.approved;
  return {
    palettes: await upsert(models.Palette, set.palettes, toDocument.palette),
    templates: await upsert(models.OutfitTemplate, set.templates, toDocument.template),
    stylingRules: await upsert(models.StylingRule, set.stylingRules, toDocument.stylingRule),
    fabricRules: await upsert(models.FabricRule, set.fabricRules, toDocument.fabricRule),
  };
}
