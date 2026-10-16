# CLAUDE.md

Guidance for Claude Code and its subagents in this repository. Keep it short; the full rules live in `docs/`.

## Project

**StyleMe**: AI-assisted fashion styling web app. pnpm monorepo, TypeScript everywhere, Node 24, pnpm 10.

| Path                 | What                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js 16 + React 19 + Tailwind 4. Pages, components, server actions, BFF API client |
| `apps/api`           | Express 5 + Mongoose 9 (MongoDB), Zod, pino. REST API under `/v1`                     |
| `packages/contracts` | Shared Zod schemas, types and error codes (`@styleme/contracts`)                      |
| `docs/`              | Requirements, architecture, API, database, security, testing and deployment docs      |

**Next.js 16 has breaking changes.** Read `apps/web/AGENTS.md` and the guides in `apps/web/node_modules/next/dist/docs/` before writing web code.

## Commands

```sh
pnpm install
pnpm dev:api                                   # http://localhost:4000 (needs local MongoDB, apps/api/.env)
pnpm dev:web                                   # http://localhost:3000 (apps/web/.env.local)
pnpm --filter @styleme/api test -- <pattern>   # targeted API tests (in-memory MongoDB)
pnpm --filter @styleme/web test -- <pattern>   # targeted web tests
pnpm --filter @styleme/contracts test
```

Before a PR, run the same checks as CI:

```sh
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
pnpm --filter @styleme/api style-rules lint   # only if style-rules changed
```

Prefer targeted tests while working; run the full suite once at the end.

## Architecture rules

- **The browser never calls the API.** Web → server action or route handler → `apps/web/lib/api/server.ts` (`apiRequest`, sends `BFF_SHARED_SECRET` + Bearer token) → API.
- **API pipeline:** route → `authenticate` / `requirePasswordSet` → `validateBody(zodSchema)` → controller (HTTP only) → service (logic) → model or `src/integrations/*` → envelope via `utils/respond.ts`.
- **Wiring:** new routes are mounted in `apps/api/src/app.ts`; services get dependencies through `AppDeps` (inject fakes in tests).
- **Contracts first:** add schemas and types in `packages/contracts/src/<area>.ts` and export them from `index.ts`. New error codes go in `ERROR_CODES` in `envelope.ts`. Never duplicate a schema in an app.
- **Config:** env vars are parsed in `apps/api/src/config/env.ts` (Zod). Errors report names only, never values.
- **State-changing server actions** check `isAllowedOrigin(...)` first (see `apps/web/app/actions/appearance.ts`).

### Pattern files to copy

| Need                             | Copy                                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| API route / controller / service | `apps/api/src/routes/appearance.routes.ts`, `controllers/appearance.controller.ts`, `services/appearance.service.ts` |
| Mongoose model                   | `apps/api/src/models/index.ts`                                                                                       |
| API test                         | `apps/api/tests/api/appearance.test.ts` (+ `tests/helpers.ts`)                                                       |
| Server action                    | `apps/web/app/actions/appearance.ts`                                                                                 |
| Form UI                          | `apps/web/components/profile/AppearanceForm.tsx`, UI kit in `apps/web/components/ui/`                                |
| Contract                         | `packages/contracts/src/appearance.ts`                                                                               |

## Must-follow rules (from `docs/CONTRIBUTING.md` §5)

- **New user-owned collection:** add it to `USER_OWNED_COLLECTIONS` in `apps/api/src/models/index.ts` in the same PR (account deletion + tombstone replay).
- **Logs:** never log request bodies, personal data, codes, tokens, photos or image URLs.
- **AI rule 16:** never send personal photos, measurements or appearance signals to an external AI provider. The core path is deterministic; AI is optional and falls back.
- **Never fabricate** products, prices, ratings, reviews or availability, in code, seeds, UI copy or docs.
- **Fixtures** are synthetic, `isFixture: true`, live only in `apps/api/tests/fixtures/`, and never reach production.
- **Secrets:** never commit `.env*` (except `.env.example`), and never use `NEXT_PUBLIC_` for secrets.
- **Migrations:** backward-compatible and numbered in `apps/api/scripts/migrations/`; agree the number with the owner (Shreya).
- **Styling content** (`apps/api/src/style-rules/data/*.json`) is founder-approved only; drafts use `reviewStatus: draft`.
- No new infrastructure (Redis, queues and so on) without a concrete need. External services only via `apps/api/src/integrations/`.

## Git workflow

- One issue → one branch `feature/<issue>-<slug>` or `fix/<issue>-<slug>` from the latest `main` → one PR with `Closes #<n>`.
- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), mentioning the issue number. Stage files by name.
- **Never merge, force-push or rewrite `main`.** PRs need a review and green CI.
- **High-conflict shared files:** keep edits minimal and expect to rebase. These are `packages/contracts/src/index.ts`, `envelope.ts`, `apps/api/src/models/index.ts`, `apps/api/src/app.ts`, `apps/api/src/config/env.ts`, `apps/web/lib/features.ts`, `pnpm-lock.yaml`. Never hand-edit the lockfile.
- When a PR changes a feature's status, update `docs/PROJECT_OVERVIEW.md` and `docs/DEVELOPMENT_ROADMAP.md` in the same PR.
- Issues labelled `needs-founder-approval`: draft only; a person approves.

## Token-saving rules for agents

- Start from the issue: `gh issue view <n> -R kedar1330/ThinkTech`. Read its "Depends on" first.
- Don't read: `pnpm-lock.yaml`, `node_modules/`, `dist/`, `.next/`, `.dev-outbox/`, or `apps/api/src/style-rules/data/*.json` (unless the task is styling content).
- Use `grep` and line ranges instead of whole files. Open the relevant `docs/*.md` section, not the whole document.
- Report back briefly: branch, PR link, files changed, test results, open questions.

## Docs index

`docs/PROJECT_OVERVIEW.md` (features and status) · `docs/DEVELOPMENT_ROADMAP.md` · `docs/TEAM_TASK_ASSIGNMENTS.md` (owners) · `docs/CONTRIBUTING.md` (workflow, rules) · `docs/API.md` · `docs/DATABASE.md` · `docs/SECURITY.md` · `docs/TESTING.md` · `docs/DEPLOYMENT.md` · `docs/ImplementationPlan.md` §8 (decision register, `D-xx`).
