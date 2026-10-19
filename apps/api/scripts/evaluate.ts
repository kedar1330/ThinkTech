// Engine evaluation (#34, TESTING.md §6). Runs synthetic profiles through the deterministic engine on
// the approved shipped library and applies the automated checks (AC-05 … AC-08, explanation fidelity,
// no product data, inclusive language). No database, network or AI. Exits 1 if any check fails.
//
//   pnpm --filter @styleme/api evaluate                         Built-in edge-case profiles, Markdown report
//   pnpm --filter @styleme/api evaluate --profiles <file.json>  A JSON array of evaluation profiles (#54)
//   pnpm --filter @styleme/api evaluate --json                  The full result as JSON instead of Markdown
//
// A profile file holds synthetic profiles only, each `{ id, request, profile, signals? }` as described
// by `evaluationProfileInputSchema` (src/services/engine/evaluate.ts). Reports name profiles by ID only.

import { readFileSync } from 'node:fs';
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

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const fileIndex = args.indexOf('--profiles');
const file = fileIndex >= 0 ? args[fileIndex + 1] : undefined;
if (fileIndex >= 0 && !file) {
  process.stderr.write('Usage: evaluate [--profiles <file.json>] [--json]\n');
  process.exit(2);
}

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
