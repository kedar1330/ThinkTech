# Draft styling content

Palettes, outfit templates, styling rules and fabric rules that are waiting for founder review ([CONTRIBUTING.md](../../../docs/CONTRIBUTING.md) §6, D-62). The files have the same names and record format as the shipped library in `src/style-rules/data/`.

**Nothing here ships.** The folder is outside `src/`, so the API never imports it, it is not in the build or the Docker image, and the runtime only ever loads `src/style-rules/data/`. Only the `style-rules` CLI and the tests read these files (`scripts/draft-library.ts`).

## Checks

```bash
pnpm --filter @styleme/api style-rules drafts                     # lint the drafts (also runs in CI)
pnpm --filter @styleme/api style-rules coverage --include-drafts  # coverage with the drafts counted
```

`style-rules drafts` lints the drafts together with the shipped library and fails on every finding (schema, references, duplicates, contradictions, judgemental language) except `NOT_APPROVED`, which is expected until the founder approves. It also fails if a record here is `approved` or `retired`: approved records belong in the shipped library.

## Drafting

Add or change records here with `reviewStatus: "draft"`, `reviewedBy: null` and `reviewedAt: null`, following the checklist in CONTRIBUTING.md §6. Never set a record to `approved` yourself.

## Colour library (D-133)

The colour library content (the hues each undertone leans towards and every sentence users see) was approved on 2026-10-22 and ships in `src/style-rules/data/colour-library.json`; nothing is waiting here. To change it, copy that file here as `colour-library.json` with `reviewStatus: "draft"`, `reviewedBy: null`, `reviewedAt: null`, edit it, and check it:

```bash
pnpm --filter @styleme/api colours:drafts               # validate (100+ colours per category, inclusive language)
pnpm --filter @styleme/api colours:report               # what each category holds
pnpm --filter @styleme/api colours:seed -- --drafts     # preview in local or staging (refused in production)
```

To approve a new draft: copy it over `src/style-rules/data/colour-library.json`, set `reviewStatus: "approved"`, `reviewedBy` and `reviewedAt`, bump `version`, delete the draft, then run `colours:seed`.

## After founder approval

Only once the founder has actually approved the records:

1. Move each approved record from this folder into the matching file in `src/style-rules/data/`, and remove it from here.
2. Set `reviewStatus: "approved"`, `reviewedBy` and `reviewedAt` as recorded by the founder, and bump `version` (CONTRIBUTING.md §6).
3. Move a template together with every palette and rule it references: an approved record may only reference approved records.
4. Run `pnpm --filter @styleme/api style-rules lint` (must report no issues) and `style-rules drafts` for whatever stays here, then open the PR.
