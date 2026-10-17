// Style knowledge base tooling (FR-STY-03, FR-STY-11). Runs in CI and locally.
//
//   pnpm style-rules lint       Validate and lint src/style-rules/data; exits 1 on any issue.
//   pnpm style-rules coverage   Print the coverage report of the approved library as Markdown.
//   pnpm style-rules coverage --include-drafts
//                               Same, counting draft and reviewed records too (for a content PR
//                               awaiting founder review). Retired records are never counted.
//
// Drafts fail `lint` with NOT_APPROVED by design: only approved records may be merged (CONTRIBUTING.md §6).

import {
  SHIPPED_LIBRARY,
  StyleLibrary,
  buildCoverageReport,
  formatCoverageReport,
  lintLibrary,
  type RecordSet,
} from '../src/style-rules';

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
  const records = includesDrafts ? withoutRetired(result.valid) : result.approved;
  process.stdout.write(formatCoverageReport(buildCoverageReport(new StyleLibrary(records)), { includesDrafts }) + '\n');
} else {
  process.stderr.write('Usage: pnpm style-rules <lint|coverage [--include-drafts]>\n');
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
