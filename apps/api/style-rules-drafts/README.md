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

## After founder approval

Only once the founder has actually approved the records:

1. Move each approved record from this folder into the matching file in `src/style-rules/data/`, and remove it from here.
2. Set `reviewStatus: "approved"`, `reviewedBy` and `reviewedAt` as recorded by the founder, and bump `version` (CONTRIBUTING.md §6).
3. Move a template together with every palette and rule it references: an approved record may only reference approved records.
4. Run `pnpm --filter @styleme/api style-rules lint` (must report no issues) and `style-rules drafts` for whatever stays here, then open the PR.
