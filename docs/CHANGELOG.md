# StyleMe — Changelog

> What changed on `main`, by merged pull request, newest first. Built from the GitHub pull-request history on 2026-10-18. Nothing is released or deployed yet (D-81); there are no version tags. Dates are merge dates (UTC). Planned work is in [TODO.md](TODO.md).

## Unreleased — open pull requests

| PR | Branch | Change | State |
|---|---|---|---|
| #71 | `feature/33-matching-engine` | feat: deterministic look engine (#33) — `services/engine/` (filterTemplates, fillSlots, rules and tiered ranking, signatures, explanations, alternatives, search phrases, palette ranking), `outfits` model with 7-day TTL, `POST /v1/recommendations`, `GET /v1/style/palettes`, `validateQuery`, library `contentVersion`, look-level contrast rules; C0 content (#32) approved by the founder on 2026-10-19 (30 records, version 2) after two correction rounds and moved to the shipped library; real AC5 test on the shipped library replaces the simulated-approval test | Open; awaiting review and CI |

## 2026-10-18

| PR | Change |
|---|---|
| #69 | feat: catalogue models, feature-spec contracts and docs (D-109 … D-128) — `catalogue`, `saved-items`, `admin`, `my-profile`, `photos` contracts and declared models; founder decisions D-102 … D-106 approved, D-117 = a, D-122 = b |
| #70 | fix(style-rules): move the unapproved C0 drafts out of the shipped library into `apps/api/style-rules-drafts/` (`style-rules drafts` check) |
| #68 | feat(style-rules): C0 styling content for founder review (#32): 8 palettes, 8 templates, 8 styling rules, 6 fabric rules, all `draft`; adds `StyleMe APP.txt` |

## 2026-10-16

| PR | Change |
|---|---|
| #67 | docs: `CLAUDE.md` agent guidance |
| #64 | feat(contracts): looks, palettes and shortlist contracts (#31) — `outfit.ts`, `palette.ts`, `product.ts`, `common.ts`; `WEAR_TYPES` in the vocabulary; `design.ts` and `chat.ts` reserved |
| #62 | docs: #30 styling-vocabulary decisions D-96 … D-101 |
| #29 | docs: team workflow, roadmap and ownership (`PROJECT_OVERVIEW`, `DEVELOPMENT_ROADMAP`, `TEAM_TASK_ASSIGNMENTS`, `PROPOSED_ISSUES`) |

## 2026-10-15

| PR | Change |
|---|---|
| #28 | feat: optional onboarding with **Skip for now**; profile completeness (`profileCompleteness()`, `departmentScope()`) on Home and in the navigation |
| #27 | test: fix a flaky appearance privacy log assertion |
| #26 | feat: responsive **top navigation** replaces the sidebar |

## 2026-10-13

| PR | Change |
|---|---|
| #25 | Public sign-up with a 6-digit email code; the account is created only after verification (`pendingRegistrations`); `PUBLIC_SIGNUP_ENABLED` defaults to `true` |
| #24 | revert: roll back PR #23 (auth and onboarding redesign) |
| #23 | Auth and onboarding redesign (D-87 … D-94); reverted by #24, then re-applied on `main` in commit `05a295c` |
| #22 | feat: style profile with category sizes and fit (#4) |
| #21 | feat: self-reported appearance signals (#5) |

## 2026-10-10

| PR | Change |
|---|---|
| #20 | Style knowledge-base tooling: record schemas, loader, linter, coverage report, scale test (#3) |
| #19 | Shared style vocabulary in `packages/contracts` (#2) |

## Before 2026-10-10

Foundation and accounts (monorepo, contracts package, Express skeleton, CI, Dockerfile, accounts) were merged through issue #1; see `git log` on `main` for individual commits.
