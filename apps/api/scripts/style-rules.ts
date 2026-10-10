// Style knowledge base tooling (FR-STY-03, FR-STY-11). Runs in CI and locally.
//
//   pnpm style-rules lint       Validate and lint src/style-rules/data; exits 1 on any issue.
//   pnpm style-rules coverage   Print the coverage report of the approved library as Markdown.
//
// Drafts fail `lint` with NOT_APPROVED by design: only approved records may be merged (CONTRIBUTING.md §6).

import {
  SHIPPED_LIBRARY,
  StyleLibrary,
  buildCoverageReport,
  formatCoverageReport,
  lintLibrary,
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
  process.stdout.write(formatCoverageReport(buildCoverageReport(new StyleLibrary(result.approved))) + '\n');
} else {
  process.stderr.write('Usage: pnpm style-rules <lint|coverage>\n');
  process.exitCode = 2;
}
