# Contributing to StyleMe

> Part of the StyleMe documentation baseline. Plan: [ImplementationPlan.md](ImplementationPlan.md). Decisions: [ImplementationPlan.md](ImplementationPlan.md) §8.

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
→ pull request → CI (typecheck, lint, style-rule linter, tests, E2E smoke, build) → review → merge
```

Commit messages follow Conventional Commits.

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

---

## 9. Decisions

Decision register: [ImplementationPlan.md](ImplementationPlan.md) §8. Relevant here: D-21, D-62, D-65, D-77, D-78, D-79, D-80.
