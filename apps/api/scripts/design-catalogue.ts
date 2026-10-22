// Design-feature catalogue (D-132): Women / Men → outfit category → garment → feature category → feature.
//
//   pnpm --filter @styleme/api design:generate   write the SVG files to apps/web/public/illustrations/design/
//   pnpm --filter @styleme/api design:seed       upsert the catalogue, images, combinations and approved rules
//                                                 into MongoDB (needs apps/api/.env)
//   pnpm --filter @styleme/api design:drafts     validate the draft suitability rules in style-rules-drafts/
//
// Output contains counts only.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config/env';
import { connectDatabase } from '../src/db';
import { DESIGN_FEATURES } from '../src/design/catalogue';
import { designIllustrations } from '../src/design/illustrations';
import { suitabilityRuleFileSchema } from '../src/design/rules';
import { approvedSuitabilityRules, seedDesignCatalogue } from '../src/design/seed';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = resolve(HERE, '../../web/public');
const DRAFTS = resolve(HERE, '../style-rules-drafts/feature-suitability-rules.json');

async function generate() {
  const records = designIllustrations();
  for (const r of records) {
    const file = join(WEB_PUBLIC, r.path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, r.svg, 'utf8');
  }
  process.stdout.write(`design illustrations written: ${records.length}\n`);
}

async function seed() {
  const config = loadConfig();
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const result = await seedDesignCatalogue(db.models, { rules: approvedSuitabilityRules() });
    process.stdout.write(
      `${Object.entries(result)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}\n`,
    );
  } finally {
    await db.close();
  }
}

/** Drafts must be valid, name real features, and stay drafts (CONTRIBUTING.md §6). */
async function drafts() {
  const file = suitabilityRuleFileSchema.parse(JSON.parse(await readFile(DRAFTS, 'utf8')));
  const known = new Set(DESIGN_FEATURES.map((f) => f.featureId));
  const unknown = file.rules.filter((r) => !known.has(r.featureId)).map((r) => r.ruleId);
  const approved = file.rules.filter((r) => r.reviewStatus === 'approved').map((r) => r.ruleId);
  const shipped = new Set(approvedSuitabilityRules().map((r) => r.ruleId));
  const duplicated = file.rules.filter((r) => shipped.has(r.ruleId)).map((r) => r.ruleId);
  const problems = [
    ...unknown.map((id) => `${id}: unknown feature`),
    ...approved.map((id) => `${id}: approved rules belong in src/style-rules/data/`),
    ...duplicated.map((id) => `${id}: also in the shipped file`),
  ];
  process.stdout.write(`draft rules: ${file.rules.length}, problems: ${problems.length}\n`);
  for (const p of problems) process.stdout.write(`  ${p}\n`);
  if (problems.length > 0) process.exit(1);
}

const command = process.argv[2];
(command === 'seed' ? seed() : command === 'drafts' ? drafts() : generate()).catch((err: unknown) => {
  process.stderr.write(`Design catalogue failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
