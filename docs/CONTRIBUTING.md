# Contributing to StyleMe

> Part of the StyleMe documentation baseline. Plan: [ImplementationPlan.md](ImplementationPlan.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.
>
> **New to the team?** Read the [README](../README.md), [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) and [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md), then follow the step-by-step workflow in §10.

---

## 1. Branches (D-21)

| Branch | Purpose |
|---|---|
| `main` | Integration branch. Before the hosting checkpoint (D-81) nothing deploys; from S1.7, merges deploy to production after CI passes |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `develop` | Not used until a release cadence needs it |

Feature branches never deploy to production. Once staging exists (after the hosting checkpoint, D-81), their pull requests deploy to staging ([DEPLOYMENT.md](DEPLOYMENT.md) §5); before that, CI only. No Git action on the shared repository happens without the founder's approval.

---

## 2. Workflow

```
Issue → feature/* or fix/* branch → contracts first → implementation → tests → local check
→ pull request → CI (typecheck, lint, format check, style-rule linter and coverage report, tests, build, Docker image build) → review → merge
```

Commit messages follow Conventional Commits. The CI steps are in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). The Playwright E2E smoke flow is planned (#7) and is not part of CI yet.

---

## 3. Definition of Done

A feature isn't complete just because the UI works. It needs: UI, API, validation, database, error handling, authorization, tests and documentation (including any change to the decision register).

---

## 4. Where Code Goes

| Location | Contains |
|---|---|
| `apps/web` | UI and design system, pages, components, server actions, session and OAuth cookies, server-side API client |
| `apps/api` | REST API, auth, models, services (look generator, budget engine; later eligibility and quality), integrations, scripts, logging |
| `apps/api/src/style-rules` | The style knowledge base (§6) |
| `apps/api/tests/fixtures` | Synthetic test fixtures only |
| `packages/contracts` | Shared Zod schemas and types |

**Backend pattern:** route → authentication → validation → controller (HTTP only) → service (business logic) → model or integration → response.

---

## 5. Rules

- TypeScript everywhere. Shared schemas live in `packages/contracts`; never duplicate them.
- Version routes under `/v1`; use the response envelope; never leak internals.
- Validate all input and all AI output with Zod.
- Keep the core deterministic. Never put an AI call on the core path; optional AI falls back to the deterministic result with the `AI_ENHANCEMENT_SKIPPED` warning and a log entry, without failing the request.
- Budget and price logic is pure code. AI never sets prices.
- User-entered items and prices are always labelled "not verified by StyleMe" and are never combined with, or presented as, verified data. Never fetch user-entered links.
- **Never fabricate** products, prices, availability, ratings, reviews, quality claims or confidence values — in code, seed data, UI copy or docs.
- **Fixtures** are synthetic, marked `isFixture: true`, live in `apps/api/tests/fixtures/`, and are loaded only by test and seed scripts that refuse to run in production. Never put a fixture where a user could see it.
- Never use affiliate status or commission in ranking or quality logic.
- Never send personal photos, measurements, appearance signals or unnecessary personal data to an external AI provider (AI rule 16).
- Get retailer data only through permitted methods. No scrapers.
- External services only through `src/integrations/`.
- Secrets server-side and per environment. Never commit `.env`; never use `NEXT_PUBLIC_` for secrets.
- Database changes use backward-compatible migrations (D-79).
- Any new user-owned collection must be added to account deletion, the tombstone replay list and its verification before it ships ([DATABASE.md](DATABASE.md) §3.1c, D-85).
- Don't add Redis, BullMQ or other infrastructure without a concrete need.

---

## 6. Styling-Content Review (founder-owned, D-62)

The founder reviews and approves all palettes, styling/fit rules, fabric rules, outfit templates and style illustrations. Content is produced in sets — C0 development seed (temporary), C1 Stage 1 release set, C2 full library of at least 100 palettes and 100 templates — following the batch process in [ImplementationPlan.md](ImplementationPlan.md) §5.2. Any contributor may draft records; only the founder approves.

**Workflow:**
1. **Draft:** create or change a record in `style-rules/` on a branch, with `reviewStatus: draft`, rationale, limitations and tags.
2. **Automated checks:** schema validation and the linter (contradictions, duplicates, unknown references, missing rationale or limitations, inclusive-language check); licence check for illustrations; the coverage report (FR-STY-11) is updated.
3. **Founder review:** against the checklist below. On approval, set `reviewStatus: approved`, `reviewedBy`, `reviewedAt`, and bump `version`.
4. **Merge:** only approved, linter-clean records are used at runtime.

**Checklist:**
- [ ] The rationale describes an effect, never a judgement.
- [ ] Limitations are stated.
- [ ] Nothing implies a body or skin tone makes something objectively unsuitable.
- [ ] Soft effect only (prefer / deprioritise).
- [ ] Tags and contexts are correct; no unintended overlap.
- [ ] Colours, contrast and combinations are consistent; coordination across slots (formality, pattern mixing, proportion, footwear and accessories) is covered.
- [ ] Fabric guidance is practical and never claims a fabric is always right.
- [ ] Style illustrations: a recorded source and licence (D-65), and the "Style illustration — not a product" label.
- [ ] Plain, inclusive language.

**Corrections:** anyone can open an issue against a record ID (including from evaluation results or user feedback). A record producing harmful or judgemental output is set to `retired` immediately, then fixed. Other corrections follow the same workflow with a version bump. The library grows only as fast as the founder can review (FR-STY-08).

---

## 7. Issue Breakdown

Issues follow the milestones in [ImplementationPlan.md](ImplementationPlan.md) §5–§7.

| Milestone | Issues |
|---|---|
| S1.1 Foundation | Monorepo and tooling · Contracts package · Express skeleton (envelope, errors, `/health`) · Next.js shell · CI workflow · Dockerfile, `docker-compose.yml` and `render.yaml` (built locally, not deployed) |
| S1.2 Accounts | User model · Auth API · Web session cookie (replaced Auth.js, D-06) · Closed-beta registration (invite allow-list) · Email verification · Google sign-in · Password change by code · Admin-assisted and self-service reset · Email change · Phone · Onboarding · Landing and design system · Account deletion with tombstone and reconciliation script · Rate limits |
| S1.3 Profile and signals | Profile module · Category sizes and fit · Self-reported signals |
| S1.4 Look engine | Knowledge-base schemas, loader and linter · Generator · Recommendations endpoint · Results UI |
| S1.5 Look experience | Explanations · Alternatives · Palettes · Size notes and search phrases · Saved looks and feedback · Optional AI wording module |
| S1.B Shortlist and budget | Shortlist module · Budget engine on user-entered prices · Price summary on saved looks · Labels |
| HC-1 Hosting checkpoint | Present hosting options and current costs; record D-81; create staging per the decision |
| S1.6 Hardening | Fixture safeguards · Security checklist · Privacy notices · Evaluation harness · E2E smoke · Latency measurement |
| S1.7 Launch (closed beta) | Production environment · Tombstone store · Maintenance mode · Backups and restore test · Monitoring · Rollback rehearsal · Release QA · Inviting beta users · Legal-review reminder |
| HC-2 Public-launch checkpoint | Legal-review reminder · Present email provider options and costs; record D-84 · Email integration · Enable self-service reset · Verify AC-24 |
| Product layer | Retailer registry · Product model and provenance validation · Curation import · Source integration (mocked until approved) · Freshness and link checks · Matching and budget · Quality evidence · Product UI |
| Stage 2 | Full content library C2 (release gate) · Weather |
| Content programme | C0 seed · C1 release set · C2 full library · Coverage report · Evaluation-set growth (founder approval; not developer-days) |

---

## 8. Documentation

Update the relevant document in `docs/` with every feature: [BRD](BRD.md) · [MVP](MVP.md) · [FRD](FRD.md) · [SRS](SRS.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATABASE](DATABASE.md) · [API](API.md) · [AI](AI.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEPLOYMENT](DEPLOYMENT.md) · [ImplementationPlan](ImplementationPlan.md).

Team documents: [PROJECT_OVERVIEW](PROJECT_OVERVIEW.md) (features and verified status) · [DEVELOPMENT_ROADMAP](DEVELOPMENT_ROADMAP.md) · [TEAM_TASK_ASSIGNMENTS](TEAM_TASK_ASSIGNMENTS.md) · [PROPOSED_ISSUES](PROPOSED_ISSUES.md). When your PR changes a feature's status, update its row in PROJECT_OVERVIEW and DEVELOPMENT_ROADMAP in the same PR.

---

## 9. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-21, D-62, D-65, D-77, D-78, D-79, D-80.

---

## 10. Team Workflow, Step by Step

The team: **Shreya** (shared styling foundation and engine), **Johita** (Discover My Style, Outfit Categories), **Ankita** (My Colour Palette, Saved Outfits, feedback), **Kedar** (Shop My Look; Design Studio and Virtual Try-On only after approval). Details: [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md).

1. **Clone and install.** Node.js 24 (`.nvmrc`) and pnpm 10 (`corepack enable`), then:
   ```sh
   git clone https://github.com/kedar1330/ThinkTech.git
   cd ThinkTech
   pnpm install
   ```
2. **Configure local environment variables.** Create `apps/api/.env` and `apps/web/.env.local` from the names in [`.env.example`](../.env.example) (see the [README](../README.md#local-setup)). Generate your own secrets; never copy someone else's. Without `SMTP_URL`, emails go to `apps/api/.dev-outbox/` and codes are printed in the API terminal.
3. **Run the app and the tests.**
   ```sh
   pnpm dev:api        # http://localhost:4000 (needs a local MongoDB)
   pnpm dev:web        # http://localhost:3000
   pnpm test           # all packages; the API tests use an in-memory MongoDB
   ```
4. **Pick your assigned issue** on GitHub (filter by assignee). If your task has no issue yet, ask for one — see the proposals in [PROPOSED_ISSUES.md](PROPOSED_ISSUES.md). One issue, one branch, one pull request.
5. **Check dependencies and interfaces.** Read the issue's "Depends on" list and the roadmap ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)). If you need a shared contract, model or file you don't own (§12), agree the change with its owner in the issue **before** coding.
6. **Branch from the latest `main`.**
   ```sh
   git switch main && git pull
   git switch -c feature/<issue-number>-<short-description>     # e.g. feature/13-saved-outfits
   ```
7. **Implement one coherent change, with tests.** Contracts first (`packages/contracts`), then the API, then the UI. Follow the Definition of Done (§3) and the rules in §5. Don't fix unrelated things in the same branch — open a separate issue.
8. **Run the required checks and inspect your diff.** All of these must pass before you open a pull request:
   ```sh
   pnpm typecheck
   pnpm lint
   pnpm format:check
   pnpm --filter @styleme/api style-rules lint      # if you touched style-rules
   pnpm test
   pnpm build
   git status
   git diff                                         # only the files your issue needs
   ```
9. **Commit** with a Conventional Commit message that says what changed, e.g. `feat: save and list outfits (#13)`. Stage files by name, not `git add .`.
10. **Open a pull request into `main`** that references the issue (`Closes #13`), summarises the change, lists the checks you ran and their results, and states anything untested.
11. **Review and merge.** At least one other member reviews; the owners of any shared files you changed approve; CI passes. Merge only after all three. Never merge your own PR without a review, and never force-push to `main`.

## 11. Branches, Issues and Pull Requests

| Item | Convention |
|---|---|
| Branch | `feature/<issue>-<short-description>` or `fix/<issue>-<short-description>` from `main` (D-21) |
| Commit | Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`; mention the issue number |
| Issue link | `Closes #<n>` in the PR description when it completes the issue; `Refs #<n>` for part of it |
| PR size | One issue; small enough to review in one sitting. Split large work into stacked PRs agreed with the reviewer |
| PR description | Summary, linked issue, screenshots for UI changes (mobile and desktop), checks run with results, known limitations |
| Before merge | CI green, at least one approving review, owners of shared files approved, no unresolved comments |
| History | Never rewrite or force-push shared branches (`main` or a branch someone else uses) |

## 12. Shared Files, Migrations, Seeds and Generated Files

* **Shared files have one owner** ([TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md) §2). Changes go through a PR the owner reviews. Highest-conflict files: `packages/contracts/src/index.ts`, `apps/api/src/models/index.ts`, `apps/api/src/app.ts`, `apps/web/lib/features.ts`, `pnpm-lock.yaml`.
* **New user-owned collections** are added to `USER_OWNED_COLLECTIONS` (account deletion and tombstone replay) in the same PR (§5).
* **Migrations** (`apps/api/scripts/migrations/`, owner Shreya): one migration per PR, numbered in order, idempotent and backward-compatible (D-79). Agree the number with the owner so two PRs don't both add `002-*`. Run with `pnpm --filter @styleme/api migrate`.
* **Styling content** (`apps/api/src/style-rules/data/*.json`, owner Shreya): any member may draft records; only the founder approves (§6). Drafts fail `style-rules lint` by design until approved.
* **Seeds.** `pnpm --filter @styleme/api seed` creates only the admin account (D-95). There is no styling-data seed command: styling content is the JSON files above, loaded when the API starts. Test fixtures stay in `apps/api/tests/fixtures/` (§5).
* **Dependencies.** Add a package only when needed, with `pnpm-lock.yaml` updated by `pnpm install`. Lockfile conflicts: take `main`'s lockfile, then run `pnpm install` again — never hand-edit it.
* **Generated and local files are never committed:** `.next/`, `dist/`, `node_modules/`, `.dev-outbox/`, `.env` and `.env.*` (except `.env.example`), screenshots and test output.

## 13. Secrets and Personal Data

* Never commit `.env` files, SMTP or App Passwords, API keys, tokens or real users' data. `.gitignore` covers `.env` and `.env.*`; check `git status` anyway.
* Use example values in docs and tests (`you@example.com`, `<16-char-app-password>`).
* Never paste secrets into issues, PRs, chat or screenshots. If one leaks, rotate it immediately and tell the team.

## 14. Conflicts and Coordination

* Fetch `main` often and rebase your branch on it **before** opening a PR: `git fetch origin && git rebase origin/main`. Rebase only your own branch that nobody else uses.
* If a conflict touches another member's file, resolve it together — never by discarding their change.
* If two PRs change the same shared file, the owner's PR merges first; the other rebases.
* Interface disagreements are settled in the issue before code, and recorded in the contract PR.
