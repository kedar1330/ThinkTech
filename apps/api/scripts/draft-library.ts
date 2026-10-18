// Draft styling content awaiting founder review (CONTRIBUTING.md §6, D-62). The records live in
// apps/api/style-rules-drafts/, outside src/, so the API never imports them and they never reach the
// shipped library or the build. Only the `style-rules` CLI and the tests read them.

import fabricRules from '../style-rules-drafts/fabric-rules.json' with { type: 'json' };
import palettes from '../style-rules-drafts/palettes.json' with { type: 'json' };
import stylingRules from '../style-rules-drafts/styling-rules.json' with { type: 'json' };
import templates from '../style-rules-drafts/templates.json' with { type: 'json' };
import { lintLibrary, type LintCode, type LintOptions, type RawLibrary } from '../src/style-rules';

export const DRAFT_LIBRARY: RawLibrary = { palettes, stylingRules, fabricRules, templates };

/** Review states a record may have while it waits in the drafts folder. */
const DRAFT_STATUSES = new Set(['draft', 'reviewed']);

export interface DraftIssue {
  /** A linter code, or NOT_A_DRAFT for an approved or retired record left in the drafts folder. */
  code: LintCode | 'NOT_A_DRAFT';
  recordId: string;
  message: string;
}

export interface DraftCheckResult {
  /** Problems that must be fixed. NOT_APPROVED on a draft record is expected and never listed. */
  issues: DraftIssue[];
  /** NOT_APPROVED findings on draft records: the expected state until the founder approves. */
  awaitingApproval: number;
}

/**
 * Lints the drafts together with the shipped library, so references to shipped records resolve and
 * clashing IDs are caught. Every linter finding counts except NOT_APPROVED on a draft record. A record
 * in the drafts folder must also still be `draft` or `reviewed`: approved records belong in the shipped
 * library, with the records they reference.
 */
export function checkDraftLibrary(
  shipped: RawLibrary,
  drafts: RawLibrary,
  options: LintOptions = {},
): DraftCheckResult {
  const combined = combineLibraries(shipped, drafts);
  const draftRecords = [...drafts.palettes, ...drafts.stylingRules, ...drafts.fabricRules, ...drafts.templates];
  const draftIds = new Set(draftRecords.map(recordId));

  const issues: DraftIssue[] = [];
  let awaitingApproval = 0;
  for (const issue of lintLibrary(combined, options).issues) {
    if (issue.code === 'NOT_APPROVED' && draftIds.has(issue.recordId)) awaitingApproval++;
    else issues.push(issue);
  }
  for (const record of draftRecords) {
    const status = (record as { reviewStatus?: unknown }).reviewStatus;
    if (typeof status === 'string' && !DRAFT_STATUSES.has(status)) {
      issues.push({
        code: 'NOT_A_DRAFT',
        recordId: recordId(record),
        message: `reviewStatus is "${status}"; only draft and reviewed records belong in style-rules-drafts`,
      });
    }
  }
  return { issues, awaitingApproval };
}

/** The shipped library and the drafts as one raw library, for linting and the coverage report. */
export function combineLibraries(shipped: RawLibrary, drafts: RawLibrary): RawLibrary {
  return {
    palettes: [...shipped.palettes, ...drafts.palettes],
    stylingRules: [...shipped.stylingRules, ...drafts.stylingRules],
    fabricRules: [...shipped.fabricRules, ...drafts.fabricRules],
    templates: [...shipped.templates, ...drafts.templates],
  };
}

function recordId(record: unknown): string {
  const id = (record as { id?: unknown }).id;
  return typeof id === 'string' ? id : '(no id)';
}
