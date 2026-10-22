// Colour library (D-133): Monk skin tone → undertone → 100+ suggested colours.
//
//   pnpm --filter @styleme/api colours:report            build the library and print what each category holds
//   pnpm --filter @styleme/api colours:drafts            validate the draft content in style-rules-drafts/
//   pnpm --filter @styleme/api colours:seed              write the approved library to MongoDB (needs apps/api/.env)
//   pnpm --filter @styleme/api colours:seed -- --drafts  write the draft for preview; refused in production
//
// Output contains counts and colour names only.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOUR_FAMILIES } from '@styleme/contracts';
import { colourLibraryContentSchema, type ColourLibraryContent } from '../src/colours/content';
import { buildColourLibrary } from '../src/colours/library';
import { seedColourLibrary } from '../src/colours/seed';
import { findJudgementalLanguage } from '../src/style-rules/inclusive-language';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPROVED = resolve(HERE, '../src/style-rules/data/colour-library.json');
const DRAFT = resolve(HERE, '../style-rules-drafts/colour-library.json');

function load(path: string): ColourLibraryContent {
  return colourLibraryContentSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

function contentFor(drafts: boolean): ColourLibraryContent {
  if (drafts) return load(DRAFT);
  if (!existsSync(APPROVED)) {
    throw new Error(
      'No approved colour library yet (src/style-rules/data/colour-library.json); use --drafts to preview',
    );
  }
  const content = load(APPROVED);
  if (content.reviewStatus !== 'approved') throw new Error('The shipped colour library must be approved');
  return content;
}

function report() {
  const content = load(existsSync(APPROVED) ? APPROVED : DRAFT);
  const library = buildColourLibrary(content);
  const byId = new Map(library.colours.map((c) => [c.colourId, c]));
  const out: string[] = [`colours in master list: ${library.colours.length} (status: ${content.reviewStatus})`];
  for (const f of COLOUR_FAMILIES) out.push(`  ${f.label}: ${library.colours.filter((c) => c.family === f.id).length}`);
  for (const cat of library.categories) {
    const scores = cat.colours.map((c) => c.score);
    out.push(
      `${cat.categoryId}: ${cat.colours.length} colours, scores ${Math.min(...scores)}–${Math.max(...scores)}; top: ${cat.colours
        .slice(0, 8)
        .map((c) => byId.get(c.colourId)!.name)
        .join(', ')}`,
    );
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

/** The draft must be valid, stay a draft, give every category 100+ colours, and use inclusive language. */
function drafts() {
  if (!existsSync(DRAFT)) {
    process.stdout.write('draft colour library: none (the shipped library is approved)\n');
    return;
  }
  const content = load(DRAFT);
  const problems: string[] = [];
  if (content.reviewStatus !== 'draft') problems.push('approved content belongs in src/style-rules/data/');
  const library = buildColourLibrary(content);
  for (const cat of library.categories) {
    if (cat.colours.length < 100) problems.push(`${cat.categoryId}: only ${cat.colours.length} colours`);
    for (const text of [cat.rationale, cat.limitations, ...cat.colours.flatMap((c) => c.reasons)])
      for (const phrase of findJudgementalLanguage(text)) problems.push(`${cat.categoryId}: "${phrase}"`);
  }
  process.stdout.write(
    `draft colour library: ${library.colours.length} colours, ${library.categories.length} categories, problems: ${problems.length}\n`,
  );
  for (const p of [...new Set(problems)]) process.stdout.write(`  ${p}\n`);
  if (problems.length > 0) process.exit(1);
}

async function seed(withDrafts: boolean) {
  const { loadConfig } = await import('../src/config/env');
  const { connectDatabase } = await import('../src/db');
  const config = loadConfig();
  if (withDrafts && config.APP_ENV === 'production')
    throw new Error('Draft colour libraries are never seeded in production');
  const db = await connectDatabase(config.MONGODB_URI, config.TOMBSTONE_STORE_URI);
  try {
    const result = await seedColourLibrary(db.models, contentFor(withDrafts));
    process.stdout.write(
      `${Object.entries(result)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n')}\n`,
    );
  } finally {
    await db.close();
  }
}

const command = process.argv[2];
const run =
  command === 'seed'
    ? seed(process.argv.includes('--drafts'))
    : command === 'drafts'
      ? Promise.resolve(drafts())
      : Promise.resolve(report());
run.catch((err: unknown) => {
  process.stderr.write(`Colour library failed: ${err instanceof Error ? err.message : 'unknown'}\n`);
  process.exit(1);
});
