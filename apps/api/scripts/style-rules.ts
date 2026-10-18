// Style knowledge base tooling (FR-STY-03, FR-STY-11). Runs in CI and locally.
//
//   pnpm style-rules lint       Validate and lint src/style-rules/data; exits 1 on any issue.
//   pnpm style-rules coverage   Print the coverage report of the approved library as Markdown.
//   pnpm style-rules coverage --include-drafts
//                               Same, counting the draft and reviewed records in style-rules-drafts/
//                               too (for content awaiting founder review). Retired records are never counted.
//   pnpm style-rules drafts     Lint style-rules-drafts/ together with the shipped library; exits 1 on any
//                               issue other than the expected NOT_APPROVED on a draft record.
//
// Drafts live in apps/api/style-rules-drafts/ and never in src/style-rules/data: `lint` fails on any
// unapproved shipped record (CONTRIBUTING.md §6, style-rules-drafts/README.md).

import {
  SHIPPED_LIBRARY,
  StyleLibrary,
  buildCoverageReport,
  formatCoverageReport,
  lintLibrary,
  type RecordSet,
} from '../src/style-rules';
import { DRAFT_LIBRARY, checkDraftLibrary, combineLibraries } from './draft-library';

const command = process.argv[2];
const result = lintLibrary(SHIPPED_LIBRARY);

if (command === 'lint') {
  const { palettes, stylingRules, fabricRules, templates } = result.valid;
  process.stdout.write(
    `Checked ${palettes.length} palettes, ${templates.length} templates, ${stylingRules.length} styling rules, ${fabricRules.length} fabric rules.\n`,
  );
  if (result.issues.length === 0) {
    process.stdout.write('Style knowledge base: no issues.\n');
  } else {
    for (const issue of result.issues) process.stdout.write(`${issue.recordId}  ${issue.code}  ${issue.message}\n`);
    process.stdout.write(`Style knowledge base: ${result.issues.length} issue(s).\n`);
    process.exitCode = 1;
  }
} else if (command === 'coverage') {
  // The report covers the approved records whether or not the lint passes, so gaps are visible early.
  const includesDrafts = process.argv.slice(3).includes('--include-drafts');
  const records = includesDrafts
    ? withoutRetired(lintLibrary(combineLibraries(SHIPPED_LIBRARY, DRAFT_LIBRARY)).valid)
    : result.approved;
  process.stdout.write(formatCoverageReport(buildCoverageReport(new StyleLibrary(records)), { includesDrafts }) + '\n');
} else if (command === 'drafts') {
  const { palettes, stylingRules, fabricRules, templates } = DRAFT_LIBRARY;
  process.stdout.write(
    `Checked drafts: ${palettes.length} palettes, ${templates.length} templates, ${stylingRules.length} styling rules, ${fabricRules.length} fabric rules.\n`,
  );
  const drafts = checkDraftLibrary(SHIPPED_LIBRARY, DRAFT_LIBRARY);
  process.stdout.write(`${drafts.awaitingApproval} record(s) awaiting founder approval (expected).\n`);
  if (drafts.issues.length === 0) {
    process.stdout.write('Draft styling content: no issues.\n');
  } else {
    for (const issue of drafts.issues) process.stdout.write(`${issue.recordId}  ${issue.code}  ${issue.message}\n`);
    process.stdout.write(`Draft styling content: ${drafts.issues.length} issue(s).\n`);
    process.exitCode = 1;
  }
} else {
  process.stderr.write('Usage: pnpm style-rules <lint|coverage [--include-drafts]|drafts>\n');
  process.exitCode = 2;
}

function withoutRetired({ palettes, stylingRules, fabricRules, templates }: RecordSet): RecordSet {
  const live = <T extends { reviewStatus: string }>(records: T[]) =>
    records.filter((r) => r.reviewStatus !== 'retired');
  return {
    palettes: live(palettes),
    stylingRules: live(stylingRules),
    fabricRules: live(fabricRules),
    templates: live(templates),
  };
}
