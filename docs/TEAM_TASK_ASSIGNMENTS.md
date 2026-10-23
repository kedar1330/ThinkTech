# StyleMe — Team Task Assignments

> Who owns what in the four-member team, how members depend on each other, and how to work in parallel without conflicting edits. Feature behaviour: [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md). Build order: [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md). Tasks, issues and status: [TODO.md](TODO.md) (the earlier proposals in [PROPOSED_ISSUES.md](PROPOSED_ISSUES.md) are now GitHub issues #30 … #61). Workflow: [CONTRIBUTING.md](CONTRIBUTING.md).

Ownership means **primary responsibility**, not permission to build deferred features. Anything marked ⛔ waits for the named founder decision ([ImplementationPlan.md](ImplementationPlan.md) §4.5, §8).

## 1. Summary

| Member | Primary ownership |
|---|---|
| **Shreya** | Shared styling database, rules, matching/ranking engine and common contracts |
| **Johita** | Discover My Style and Outfit Categories |
| **Ankita** | My Colour Palette, Saved Outfits and feedback |
| **Kedar** | Shop My Look and Design Studio after approval; the 2D illustrative Virtual Try-On (approved, D-119); photo-based try-on subject to approval (D-48) |

**Feature specifications of 2026-10-18 (D-109 … D-128)** follow these areas: Shreya — shared catalogue in MongoDB, import, suitability engine and the new contracts (`catalogue.ts`, `saved-items.ts`, `admin.ts`); Johita — Discover My Style and Outfit Categories as specified; Ankita — My Colour Palette (full) and the one save system for Saved Outfits; Kedar — Shop My Look (full) and the 2D Virtual Try-On. **Admin Panel and the illustration set have no owner yet** — to agree at the next kickoff ([TODO.md](TODO.md) §6b).

## 2. Owners of shared files

Every shared file has exactly one owner. Others change it only through a pull request that the owner reviews, after agreeing the change in the issue first. *Proposed — confirm at the team kickoff; Shreya's ownership of shared schemas follows the task brief, and the platform files go to Kedar, who built Milestone 1.*

| Shared area | Files | Owner |
|---|---|---|
| Style vocabulary | `packages/contracts/src/style-vocabulary.ts` | Shreya |
| Profile and appearance contracts | `packages/contracts/src/profile.ts`, `appearance.ts` | Shreya |
| Styling, outfit and recommendation contracts | `packages/contracts/src/outfit.ts`, `palette.ts`, `common.ts` (defined in #31, PR #64) and any new styling contract | Shreya |
| Style knowledge base | `apps/api/src/style-rules/**` (schemas, loader, linter, coverage, `data/*.json`), `apps/api/scripts/style-rules.ts`, `apps/api/tests/fixtures/style-library.ts` | Shreya |
| Database models and the deletion list | `apps/api/src/models/index.ts` (all collections, `USER_OWNED_COLLECTIONS`), `models/catalogue.ts` and `models/user-collections.ts` (specified feature collections), `apps/api/scripts/migrations/` | Shreya |
| Catalogue, saved-items and admin contracts | `packages/contracts/src/catalogue.ts`, `saved-items.ts`, `admin.ts` | Shreya |
| Contracts index | `packages/contracts/src/index.ts` | Shreya |
| Auth, account, onboarding, completeness | `packages/contracts/src/auth.ts`, `profile-completeness.ts`, `apps/api/src/services/{auth,account,onboarding,…}`, `apps/web/app/(auth)/**`, `apps/web/app/onboarding/**`, `/settings` | Kedar |
| App shell and navigation | `apps/web/components/app/{AppShell,TopNav}.tsx`, `apps/web/lib/features.ts`, `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/home/page.tsx` | Kedar |
| API wiring | `apps/api/src/app.ts` (route registration), `apps/api/src/config/env.ts`, `.env.example` | Kedar |
| CI and tooling | `.github/workflows/ci.yml`, root `package.json`, `eslint.config.js`, `.prettierrc.json`, `pnpm-lock.yaml` | Kedar |
| Product and shortlist contracts | `packages/contracts/src/product.ts` (Stage 1 shortlist and user-entered price summary, defined in #31; retailer products not yet) | Kedar |
| Design contracts (after D-76) | `packages/contracts/src/design.ts` (reserved, intentionally empty and not exported) | Kedar |
| Assistant contracts (after D-76) | `packages/contracts/src/chat.ts` (reserved, intentionally empty and not exported) | Shreya |
| Decision register and approved requirements | `docs/ImplementationPlan.md` §8, approved FRD requirements | Founder (members propose changes) |

**Feature switch in navigation.** Each member turns their own section from "Coming soon" into a live page by setting `href` on their entry in `apps/web/lib/features.ts`, in their feature PR (Kedar reviews).

## 3. How we coordinate

1. **Contracts first.** Shreya publishes the request and response shapes (`packages/contracts`) for recommendations, outfits and palettes before the features that consume them integrate. Feature owners review the contract PR. *Done for Stage 1 shapes in #31 (PR #64, 2026-10-16).*
2. **Build against fixtures until the real data lands.** The synthetic library (`buildFixtureLibrary()` in `apps/api/tests/fixtures/style-library.ts`) and test helpers let Johita and Ankita develop and test before founder-approved content exists. Fixtures never ship (CONTRIBUTING §5).
3. **One issue, one branch, one PR.** Small PRs from `main`. If you need another member's unmerged work, wait or agree on a stacked PR; don't copy their files.
4. **Integration checkpoints** at the end of each roadmap milestone ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) §4): every owner rebases on `main`, runs the full checks, and demonstrates the joint flow.
5. **Conflicts.** If two PRs touch the same shared file, the file's owner merges first and the other rebases. Never resolve a conflict by deleting someone else's change.

## 4. Members

### 4.1 Shreya — Shared Styling Foundation and Core Engine

**Boundaries.** Owns styling data, rules, the engine and the shared styling contracts. Does not build feature pages (Johita, Ankita) or shopping (Kedar). Content is drafted by any member but **approved only by the founder** (D-62).

**Responsibilities and deliverables**
* Audit the vocabulary, record schemas and tooling against the PDF palette and template databases (PDF p1, p9).
* C0 development seed: ≥ 6 palettes, ≥ 6 templates and the rules they reference, as a proposal for founder approval (#9); then the C1 release set (#10).
* Look engine: matching, ranking, combination signatures, defaults and conflicts, `INSUFFICIENT_MATCHES` (never padded), the `outfits` model, `POST /v1/recommendations` (FR-LOOK, AI.md §3).
* Explanation fidelity, diversity, alternatives and search phrases in the engine (FR-LOOK-12 … 15); palette ranking for `GET /v1/style/palettes` (FR-PAL).
* Contracts for recommendations, outfits and palettes; coverage reports and evaluation support.
* Style Assistant built (D-136, 2026-10-23). Later: shared weather-styling rules (⛔ Stage 2, D-60).

**Likely files.** `packages/contracts/src/{style-vocabulary,outfit,profile,appearance,index}.ts`; `apps/api/src/style-rules/**`; new `apps/api/src/services/recommendation*.ts`, controller and routes; `apps/api/src/models/index.ts`; tests in `apps/api/tests/unit/style-rules*.test.ts` and new engine tests.

**Interfaces.** Provides contracts and APIs to Johita (looks, alternatives), Ankita (palettes, outfit records for saving and feedback) and Kedar (look slots for the shortlist). Consumes the profile and appearance data.

**Can start now.** The schema and vocabulary audit; the C0 content proposal; the engine against the fixture library (the earlier issue #11 noted it could start once #3 was merged — it is).
**Must wait.** Shipping real looks waits for founder-approved C0/C1 content. Assistant and weather wait for D-76 and D-60.

**Tests.** Linter and loader unit tests for every new rule type; engine tests T-12 … T-19, T-24, T-28 ([TESTING.md](TESTING.md) §4–§5): determinism, hard constraints (disliked colours, avoided fabrics, coverage, department), diversity, no padding, inclusive-language check; the scale test T-38; contract tests in `packages/contracts/tests`.

**Acceptance.** `style-rules lint` clean on approved content; coverage report attached to the PR; engine returns deterministic looks on C0 with no hard-constraint violations; contracts reviewed by Johita and Ankita.

**Out of scope.** Feature pages, saved-look UI, shopping, photo analysis, measurements, retailer data.

**Issues.** #30 ✅, #31 ✅, #63 (closed but only `WEAR_TYPES` implemented), #32 (C0 approved 2026-10-19, PR pending), #33 (built and verified on C0, PR pending), #34, #35, #55. Details: [TODO.md](TODO.md) §2.

### 4.2 Johita — Discover My Style and Outfit Categories

**Boundaries.** Owns the Discover My Style results experience and the Outfit Categories gallery. Uses Shreya's engine and contracts; does not change engine rules or styling data directly.

**Responsibilities and deliverables**
* Discover My Style request form: occasion (required), category, style, palette mode; colour, fit and budget from the profile.
* Results: up to 5 looks with slots, swatches and explanations; alternatives per slot (3–5 or `ALTERNATIVES_LIMITED`); details view with garments and styling tips.
* Outfit Categories: category → garment type → filters → ranked gallery (needs an approved requirement, [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #6).
* Actions: save (Ankita's API), shop (Kedar's shortlist), request alternatives.
* Empty, loading and error states; the "no department filter applied" label when no department is set (`departmentScope()`).

**Likely files.** New `apps/web/app/(app)/discover/**` or results route, `apps/web/app/(app)/categories/**` (or replace the `features/[slug]` placeholders), `apps/web/components/outfits/**` (empty placeholder folder today), server actions in `apps/web/app/actions/`; entries in `apps/web/lib/features.ts`.

**Interfaces.** Consumes `POST /v1/recommendations` and the outfit contracts (Shreya); calls save and feedback (Ankita) and shortlist (Kedar).

**Can start now.** UI and component tests against the agreed contract shapes with fixture data; the Outfit Categories requirement draft.
**Must wait.** Live integration waits for #33 to merge (engine built; C0 approved 2026-10-19).

**Tests.** Component tests for filters, results, alternatives and empty, loading and error states; integration test of request → results → save → shop; responsive checks at 320, 390, 768 and 1366 px.

**Acceptance.** An occasion-only request shows looks or a clear `INSUFFICIENT_MATCHES` message (AC-05); no duplicate looks (AC-08); every look has an explanation; works on mobile and desktop.

**Out of scope.** Engine rules, styling data, saved-look storage, shopping data, Design Studio.

**Issues.** #44, #45, #46, #47, #48, #49, #53, #54. Details: [TODO.md](TODO.md) §3.

### 4.3 Ankita — My Colour Palette, Saved Outfits and Feedback

**Boundaries.** Owns palette presentation, the saved-look collection and feedback. Palette data and ranking come from Shreya.

**Responsibilities and deliverables**
* My Colour Palette: personalised palettes (when tone, undertone or colour preferences exist) and browse-all; swatches, colour names, hex codes, combinations with contrast level, coordinating colours; never excludes a liked colour (FR-PAL-03).
* Saved Outfits: save, list, open, remove with confirmation (FR-OUT-01 … 03); owner-only access.
* Feedback: "love it" / "not for me" with an optional reason (FR-OUT-04); request alternatives.
* "Save palette" only if the founder approves the requirement ([PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) §15 #7).

**Likely files.** `apps/web/app/(app)/palette/**` and `saved/**` (or replace placeholders), new outfit save, list and feedback endpoints in `apps/api` (service, controller, routes), a feedback model in `apps/api/src/models/index.ts` — added through Shreya's review, and to `USER_OWNED_COLLECTIONS` so account deletion removes it.

**Interfaces.** Consumes palettes and outfit records (Shreya); provides save and feedback actions to Johita; provides saved looks to Kedar's shortlist.

**Can start now.** Palette UI against the vocabulary's colours and hex codes plus fixture palettes; saved-look API design (contract proposal to Shreya).
**Must wait.** Saving needs the `outfits` model (#33); personalised ranking needs approved palettes (#32) and the engine (#33).

**Tests.** API tests: save, list, open and delete; another user's look returns not-found; feedback validation; deleting an account deletes saved looks and feedback (tombstone replay list). Component tests: palette cards, removal confirmation, empty collection.

**Acceptance.** Users see only their own saved looks; removal requires confirmation; feedback is stored and never overrides explicit profile preferences; palettes show names and codes and work on mobile.

**Out of scope.** Palette data and ranking rules, recommendation generation, shopping.

**Issues.** #39, #40, #41, #42, #50, #51, #52. Details: [TODO.md](TODO.md) §4.

### 4.4 Kedar — Shop My Look and Design Studio

**Boundaries.** Owns shopping in Stage 1 (shortlist of user-found items and the budget summary), product-data validation and disclosures when a source is authorised, and — only after approval — Design Studio and Virtual Try-On. Also maintains the platform files listed in §2.

**Responsibilities and deliverables**
* Budget engine as pure functions on user-entered prices (FR-BUD, earlier issue #8).
* Shortlist: add, edit and remove items the user found (name, optional https link, entered price, optional note), attach to a look slot, budget summary on saved looks; "not verified by StyleMe" labels; StyleMe never fetches the link (FR-LIST, D-77, D-80, earlier issue #14).
* Shop My Look page: budget, category and size filters over the shortlist and saved looks; clear "product data unavailable" state.
* Product-data validation, provenance and disclosures (FR-PROD, D-46) — ⛔ only once a retailer authorises access (D-43 … D-45, D-74).
* Design Studio — ⛔ after D-76. Virtual Try-On — ⛔ after D-48, a privacy review and consent design.

**Likely files.** New shortlist contract and `packages/contracts/src/product.ts`; new shortlist model (through Shreya's review, added to `USER_OWNED_COLLECTIONS`), service, controller and routes in `apps/api`; budget functions; `apps/web/app/(app)/shop/**` (or replace the placeholder); `apps/web/components/products/**`.

**Interfaces.** Consumes saved looks and slots (Ankita, Shreya); provides "shop this look" to Johita.

**Can start now.** Budget engine (pure functions, no dependencies); shortlist items not attached to a look (D-80 allows unattached items).
**Must wait.** Attaching items to look slots needs `outfits` (#33) and saved looks (#41). Real products, Design Studio and Try-On wait for their approvals.

**Tests.** Budget unit tests (totals, over/under budget, INR limits); shortlist API tests (validation, https only, ownership, deletion with the account); component tests for labels and unavailable states.

**Acceptance.** User-entered prices are always labelled; no link is ever fetched; budget totals are correct; no real product, price or retailer appears without an authorised source.

**Out of scope.** Scraping, real retailer integration before approval, checkout or payments, Design Studio and Try-On before approval.

**Issues.** #36, #37, #38, #43, #56, #57, #58, #59, #60, #61, #65, #66. Details: [TODO.md](TODO.md) §5–§6.

## 5. Earlier GitHub issues and the new ownership

Issues #1 … #18 were assigned before this matrix and were **all closed on 2026-10-15** (marked completed) without new commits on `main`. Checked against the code, #1 … #5 are on `main`; the core work of the others is not — for example there is no styling content, look engine, saved-look or shortlist model, Playwright harness or production environment — and it is carried by the proposed issues ([PROPOSED_ISSUES.md](PROPOSED_ISSUES.md)). **Nothing has been reopened or reassigned** — the right-hand column is where the remaining work is proposed to go.

| Issue | Assignee when closed | Topic | Remaining work proposed for |
|---|---|---|---|
| #1 | Kedar | Merge foundation and accounts | Done — the work is on `main` |
| #9 | Kedar | C0 development seed | → Shreya (SH-2) |
| #10 | Kedar | C1 release set | → Shreya (SH-3, later) |
| #11 | Kedar | Look generator, recommendations API, outfits, results page | Split: engine, model and API → Shreya (SH-4); results page → Johita (JO-2) |
| #12 | Johita | Explanations, alternatives, size notes, search phrases, palette view | Split: engine side → Shreya (SH-4); alternatives UI → Johita (JO-4); palette view → Ankita (AN-1) |
| #13 | Ankita | Saved looks and feedback | Ankita (AN-3, AN-4) — no change |
| #8 | Ankita | Budget engine | → Kedar (KE-1) |
| #14 | Shreya | Shortlist with price summary | → Kedar (KE-1, KE-3) |
| #15 | Johita | Evaluation set and harness | Not covered by the matrix — keep, or move to Shreya with the engine |
| #6, #7, #16 | Ankita | Fixture safeguards, Playwright E2E, hardening | Not covered by the matrix — keep, revisit at milestone 9 |
| #17 | Kedar | Hosting checkpoint HC-1 | Kedar — no change |
| #18 | Shreya | Production closed-beta launch | Shreya — no change |

## 6. Current GitHub issues (created 2026-10-16/17)

The proposals SH-x, JO-x, AN-x and KE-x became these issues. Assignees are as on GitHub on 2026-10-18; status is verified against the code in [TODO.md](TODO.md).

| Proposal | Issue(s) | Assignee |
|---|---|---|
| SH-1 audit | #30 ✅ | Shreya |
| SH-5 contracts | #31 ✅ | Shreya |
| (vocabulary decisions) | #63 (closed; Part 1 incomplete) | Shreya |
| SH-2 C0 proposal | #32 (PR #68) | Shreya |
| SH-4 engine | #33, #34 | Shreya |
| SH-3 approved content / C1 | #35 | Shreya |
| (optional AI wording) | #55 | Shreya |
| SH-6 assistant and weather | — (no issue; deferred) | Shreya |
| JO-1 request form | #45 | Johita |
| (size notes) | #46 | Johita |
| JO-2 results page | #47 | Johita |
| JO-3 Outfit Categories gallery | TD-FS-OCAT-01 (FR-OCAT; spec check #44) | Johita |
| JO-4 alternatives | #48 | Johita |
| (regenerate) | #49 | Johita |
| JO-6 tests | #53 | Johita |
| (evaluation set, earlier #15) | #54 | Johita |
| AN-1 palette browsing | #39 | Ankita |
| AN-2 personalised palettes | #40 | Ankita |
| AN-3 saved outfits | #41 | Ankita |
| AN-4 feedback | #42 | Ankita |
| (illustrations) | #50 | Ankita |
| AN-5 tests | #51 | Ankita |
| (fixture safeguards, earlier #6) | #52 | Ankita |
| KE-1 budget engine and shortlist | #37, #38 | Kedar |
| KE-3 shop integration | #43 | Kedar |
| KE-2 retailer data | #57 | Kedar |
| KE-4 Design Studio | #56 | Kedar |
| KE-5 Virtual Try-On | #58; proposal #65 | Kedar |
| (Playwright, earlier #7) | #36 | Kedar |
| (hardening, earlier #16) | #59 | Kedar |
| (HC-1, earlier #17) | #60 | Kedar |
| (closed-beta readiness, earlier #18) | #61 | Kedar |
| (demo deployment proposal) | #66 — conflicts with D-75; founder decision needed | Kedar |

Two earlier open questions are now settled by these assignments: the evaluation set (earlier #15) stays with Johita (#54), and fixture safeguards (earlier #6) stay with Ankita (#52), while Playwright and hardening (earlier #7, #16) moved to Kedar (#36, #59) and closed-beta readiness (earlier #18) moved from Shreya to Kedar (#61).
