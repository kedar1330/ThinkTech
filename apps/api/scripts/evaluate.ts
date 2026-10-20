// Engine evaluation (#34, TESTING.md §6). Runs synthetic profiles through the deterministic engine on
// the approved shipped library and applies the automated checks (AC-05 … AC-08, explanation fidelity,
// no product data, inclusive language). No database, network or AI. Exits 1 if any check fails.
//
//   pnpm --filter @styleme/api evaluate                         Built-in edge-case profiles, Markdown report
//   pnpm --filter @styleme/api evaluate --profiles <file.json>  A JSON array of evaluation profiles (#54)
//   pnpm --filter @styleme/api evaluate --json                  The full result as JSON instead of Markdown
//   … --export-review <out.csv>     Also writes the looks as CSV for the founder relevance review (D-52)
//   … --import-review <marked.csv>  Also reads the founder's marks and reports the relevance rate
//
// A profile file holds synthetic profiles only, each `{ id, request, profile, signals? }` as described
// by `evaluationProfileInputSchema` (src/services/engine/evaluate.ts). Reports name profiles by ID only.
// The #54 dataset is tests/evaluation/profiles/stage1.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  evaluationProfileInputSchema,
  formatEvaluationReport,
  runEvaluation,
  summarizeEvaluation,
  toEvaluationProfile,
  type EvaluationProfile,
} from '../src/services/engine';
import { loadStyleLibrary } from '../src/style-rules';
import { edgeCaseProfiles } from '../tests/fixtures/profiles';
import { formatRelevance, parseReviewCsv, relevanceRate, reviewRows, toCsv } from './evaluation-review';

const USAGE =
  'Usage: evaluate [--profiles <file.json>] [--json] [--export-review <out.csv>] [--import-review <marked.csv>]\n';
const args = process.argv.slice(2);
const asJson = args.includes('--json');

/** The value after `name`, or `undefined` when the flag is absent; exits with the usage when it has none. */
function option(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    process.stderr.write(USAGE);
    process.exit(2);
  }
  return value;
}

const file = option('--profiles');
const exportReview = option('--export-review');
const importReview = option('--import-review');

function loadProfiles(path: string): EvaluationProfile[] {
  const parsed = z.array(evaluationProfileInputSchema).safeParse(JSON.parse(readFileSync(resolve(path), 'utf8')));
  if (!parsed.success) {
    // Paths and issue messages only: never the profile values.
    for (const issue of parsed.error.issues.slice(0, 10))
      process.stderr.write(`${issue.path.join('.')}: ${issue.message}\n`);
    process.exit(2);
  }
  return parsed.data.map(toEvaluationProfile);
}

const library = loadStyleLibrary();
const profiles = file ? loadProfiles(file) : edgeCaseProfiles();
const entries = runEvaluation(profiles, library);
const summary = summarizeEvaluation(entries, library);

process.stdout.write(
  asJson ? JSON.stringify({ summary, entries }, null, 2) + '\n' : formatEvaluationReport(entries, library) + '\n',
);
if (summary.passed < summary.profiles) process.exitCode = 1;

if (exportReview) {
  const rows = reviewRows(entries, library.contentVersion);
  writeFileSync(resolve(exportReview), toCsv(rows), 'utf8');
  process.stderr.write(`Wrote ${rows.length} looks for review to ${exportReview}\n`);
}

if (importReview) {
  try {
    const marks = parseReviewCsv(readFileSync(resolve(importReview), 'utf8'));
    process.stdout.write('\n' + formatRelevance(relevanceRate(marks, entries, library.contentVersion)) + '\n');
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  }
}
