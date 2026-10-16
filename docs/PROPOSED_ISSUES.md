# StyleMe — Proposed GitHub Issues

> **Proposal for team and founder review. None of these issues has been created or assigned on GitHub.** Owners follow [TEAM_TASK_ASSIGNMENTS.md](TEAM_TASK_ASSIGNMENTS.md); order follows [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md). Where an earlier issue described the same work, it is named so its description can be reused. GitHub issues #1 … #18 were all closed on 2026-10-15 (marked completed) without new commits on `main`; statuses come from the code, not from issue state.

**Start:** 🟢 can start now · 🟡 starts now but integration waits for the named dependency · 🔴 waits for the dependency or approval.

Every issue also follows the Definition of Done in [CONTRIBUTING.md](CONTRIBUTING.md) §3: UI, API, validation, database, error handling, authorisation, tests and documentation, with the checks in §10 passing.

## Overview

| ID | Title | Owner | Start | Depends on | Earlier issue (closed) |
|---|---|---|---|---|---|
| SH-1 | Audit styling schemas, vocabulary and seed tooling | Shreya | 🟢 | — | — |
| SH-2 | Prepare the C0 styling-database content proposal | Shreya | 🟢 | SH-1 | #9 |
| SH-3 | Add founder-approved palette and template content | Shreya | 🔴 | SH-2, founder approval (D-62) | #9, #10 |
| SH-4 | Build and test the matching/ranking engine and recommendations API | Shreya | 🟡 | SH-5; approved content for real looks | #11, #12 (engine side) |
| SH-5 | Define the shared styling contracts (recommendations, outfits, palettes) | Shreya | 🟢 | SH-1 | — |
| SH-6 | Style Assistant logic and shared weather-styling rules | Shreya | 🔴 | D-76 (assistant), D-60 and Stage 2 (weather) | — |
| JO-1 | Discover My Style request form and filters | Johita | 🟡 | SH-5 | #11 (results page) |
| JO-2 | Integrate recommendation results and ranking | Johita | 🔴 | SH-4 | #11 |
| JO-3 | Outfit Categories and its gallery | Johita | 🔴 | Approved requirement; SH-4 | — |
| JO-4 | Outfit details, explanations and alternatives | Johita | 🔴 | SH-4 | #12 |
| JO-5 | Integrate saving and shopping actions | Johita | 🔴 | AN-3, KE-3 | — |
| JO-6 | Discover and Categories tests (feature and integration) | Johita | 🟡 | JO-1 … JO-5 | — |
| AN-1 | My Colour Palette page and palette browsing | Ankita | 🟡 | SH-5; palettes from SH-3 | #12 (palette view) |
| AN-2 | Personalised palette matching integration | Ankita | 🔴 | SH-4 (palette ranking) | #12 |
| AN-3 | Saved Outfits CRUD with permission checks | Ankita | 🔴 | SH-4 (`outfits` model) | #13 |
| AN-4 | Feedback and alternatives on looks | Ankita | 🔴 | AN-3 | #13 |
| AN-5 | Persistence, authorisation and UI tests for palettes and saved outfits | Ankita | 🟡 | AN-1 … AN-4 | — |
| KE-1 | Shop My Look filtering, budget engine and shortlist | Kedar | 🟢 | — (attaching to looks waits for AN-3) | #8, #14 |
| KE-2 | Product-data validation and disclosures | Kedar | 🔴 | Authorised retailer (D-43 … D-46, D-74) | — |
| KE-3 | Integrate shopping with recommended and saved looks | Kedar | 🔴 | SH-4, AN-3 | #14 |
| KE-4 | Design Studio | Kedar | 🔴 | D-76 | — |
| KE-5 | Virtual Try-On planning (separately approved feature) | Kedar | 🔴 | D-48, privacy review, AI rule 16 | — |

---

## Shreya

### SH-1 — Audit styling schemas, vocabulary and seed tooling
* **Problem / behaviour.** Before content is written, confirm the record schemas and vocabulary can express the PDF's palette database (cool/warm, 100+ colours) and dress-design database (by department, style and body description), and that the tooling (linter, coverage, scale test) is ready.
* **Scope.** Review `packages/contracts/src/style-vocabulary.ts` and `apps/api/src/style-rules/**`; list gaps (e.g. a "kids" department, body-shape names vs. proportion descriptors); propose vocabulary changes for founder approval.
* **Out of scope.** Changing approved vocabulary without approval; content; photo or measurement inputs.
* **Modules.** Vocabulary, record schemas, linter, coverage report.
* **Acceptance.** A written gap list in the issue; each proposed vocabulary change marked for founder approval; no code change without approval.
* **Tests.** None required (audit); any approved change needs vocabulary and linter tests.
* **Docs.** Findings summarised in the issue; approved changes to [AI.md](AI.md) §4 and [DATABASE.md](DATABASE.md) §6.
* **Approval.** Founder for any vocabulary change (D-62).

### SH-2 — Prepare the C0 styling-database content proposal (earlier #9)
* **Problem / behaviour.** The engine needs real (approved) development content: ≥ 6 palettes, ≥ 6 outfit templates with `slotId`s, and the rules they reference.
* **Scope.** Draft records in `apps/api/src/style-rules/data/*.json` with `reviewStatus: "draft"`, rationale, limitations and tags; coverage report; founder review package.
* **Out of scope.** C1 release content; approving records yourself.
* **Acceptance.** Every record passes schema checks; only `NOT_APPROVED` remains in `style-rules lint` before approval; rationales describe effects, never judgements (CONTRIBUTING §6 checklist).
* **Tests.** `style-rules lint` and the existing style-rules unit tests.
* **Docs.** Coverage report attached to the PR.
* **Approval.** Founder (D-62). The PR stays open until approval because draft records fail the lint by design.

### SH-3 — Add founder-approved palette and template content (#9, then #10)
* **Problem / behaviour.** Ship approved C0, then the C1 release set (12–20 palettes, about 20 templates, rules covering every FR-STY-09 area).
* **Scope.** Set `reviewStatus: "approved"`, `reviewedBy` and `reviewedAt` only after founder approval; fill coverage gaps.
* **Acceptance.** Lint clean; for C1, coverage report with no empty supported cell; evaluation set (#15) run.
* **Tests.** Lint, coverage and engine tests on the approved set.
* **Approval.** Founder for every record.

### SH-4 — Build and test the matching/ranking engine and recommendations API (#11, engine side of #12)
* **Problem / behaviour.** Turn a request (occasion, optional category, style, palette mode) and the profile into up to 5 deterministic, explained looks.
* **Scope.** Templates → palettes → rules (precedence: hard constraints > explicit preferences > rules > signals); combination signatures; `DEFAULTS_APPLIED`, `PREFERENCE_CONFLICT`, `INSUFFICIENT_MATCHES` (never padded); explanations, alternatives and search phrases (FR-LOOK-12 … 15); `outfits` model with `slotId` per slot and a 7-day expiry; `POST /v1/recommendations`; palette ranking for `GET /v1/style/palettes`; general results when no department is set (`departmentScope()`).
* **Out of scope.** Products, prices or retailers on looks (FR-LOOK-18); AI wording (optional, D-67); feature pages.
* **Modules.** New service, controller and routes in `apps/api`; `apps/api/src/models/index.ts` (owner: Shreya); `packages/contracts/src/outfit.ts`.
* **Acceptance.** T-12 … T-19, T-24, T-28 pass; AC-05 … AC-08 on C0; no hard-constraint violation; deterministic for the same input and content version.
* **Tests.** Unit (ranking, signatures, precedence), API (validation, auth, empty results), fixture-library and scale tests.
* **Docs.** [API.md](API.md) §3.5, [DATABASE.md](DATABASE.md) `outfits`, [AI.md](AI.md) §3.

### SH-5 — Define the shared styling contracts
* **Problem / behaviour.** Johita, Ankita and Kedar need stable request and response shapes before integrating.
* **Scope.** Zod schemas and types for the recommendation request and response, the outfit (look, slot, explanation, alternatives) and palette responses, in `packages/contracts`; exported from `index.ts`.
* **Acceptance.** Reviewed and approved by Johita, Ankita and Kedar in the PR; documented in [API.md](API.md).
* **Tests.** Contract unit tests (valid and invalid examples).

### SH-6 — Style Assistant logic and shared weather-styling rules (later)
* **Problem / behaviour.** PDF p19 (assistant) and p7 (weather).
* **Scope.** Planning only until D-76 (assistant) and D-60 / Stage 2 (weather) are decided; then intent handling on the shared rules, and weather bands in fabric rules (FR-WX).
* **Out of scope.** Sending personal data, photos or appearance signals to external AI (AI rule 16).
* **Approval.** Founder: D-76, D-60.

---

## Johita

### JO-1 — Discover My Style request form and filters (results page part of earlier #11)
* **Problem / behaviour.** The user chooses an occasion (required), and optionally category, style and palette mode, then requests looks; profile colours, fit and budget apply automatically.
* **Scope.** Form, validation and server action; profile summary of what will be applied; "no department filter applied" when no department is set; loading state.
* **Out of scope.** Engine logic; editing the profile (link to `/profile`).
* **Modules.** New route under `apps/web/app/(app)/`, `apps/web/components/outfits/`, `apps/web/lib/features.ts` entry (Kedar reviews).
* **Acceptance.** Keyboard accessible; usable at 320 px; invalid input shows field errors.
* **Tests.** Component tests for the form and states.

### JO-2 — Integrate recommendation results and ranking (#11)
* **Scope.** Call `POST /v1/recommendations`; show up to 5 looks with slots, swatches and explanations in ranked order; `INSUFFICIENT_MATCHES`, `DEFAULTS_APPLIED` and `PREFERENCE_CONFLICT` messages; retry on failure.
* **Acceptance.** AC-05 (occasion-only request shows looks or a clear message), AC-08 (no repeated combination).
* **Tests.** Component and integration tests with fixture responses; API failure test.
* **Depends on.** SH-4.

### JO-3 — Outfit Categories and its gallery
* **Problem / behaviour.** PDF p16: category → garment type → occasion, style, colour, budget → ranked gallery of designs.
* **Scope.** First write the requirement (no FRD section exists) for founder approval; then the gallery on the engine.
* **Out of scope.** Measurement- or photo-based filtering.
* **Approval.** The requirement.
* **Tests.** Filters, empty results, ranking order.

### JO-4 — Outfit details, explanations and alternatives (#12)
* **Scope.** Details view (garments, styling tips, search phrases); 3–5 alternatives per slot or `ALTERNATIVES_LIMITED`; request alternatives.
* **Acceptance.** Alternatives never padded (D-53); explanations shown as the engine returns them.
* **Tests.** Component tests including the limited case.

### JO-5 — Integrate saving and shopping actions
* **Scope.** "Save" calls Ankita's save API; "Shop this look" opens Kedar's shortlist for the look.
* **Depends on.** AN-3, KE-3.
* **Tests.** Integration tests for both actions, including failure messages.

### JO-6 — Discover and Categories tests
* **Scope.** Fill coverage gaps; responsive checks at 320, 390, 768, 1366 px; empty and error states; E2E path occasion → looks → save (with #7).

---

## Ankita

### AN-1 — My Colour Palette page and palette browsing (palette view of earlier #12)
* **Problem / behaviour.** PDF p15: see palettes with swatches, colour names, hex codes and combinations; browse all curated palettes.
* **Scope.** Palette list and detail; coordinating colours; "explore matching outfits" link (after JO-2); empty state when no approved palettes exist.
* **Out of scope.** Palette data and ranking rules (Shreya); "save palette" until approved.
* **Modules.** New route under `apps/web/app/(app)/`, components, `lib/features.ts` entry.
* **Acceptance.** Names and codes visible and readable; liked colours never excluded (FR-PAL-03); works at 320 px.
* **Tests.** Component tests for cards, detail and empty state.

### AN-2 — Personalised palette matching integration
* **Scope.** Call the palette endpoint; personalised ranking when tone, undertone or colour preferences exist; otherwise the general collection with an explanation of why.
* **Depends on.** SH-4. **Acceptance.** FR-PAL-01 … 03. **Tests.** Integration with fixture palettes.

### AN-3 — Saved Outfits CRUD with permission checks (#13)
* **Scope.** `POST /v1/outfits/:id/save`, `GET /v1/outfits`, `GET /v1/outfits/:id`, `DELETE /v1/outfits/:id`; UI list, details, removal with confirmation; empty collection state.
* **Acceptance.** FR-OUT-01 … 03; another user's look is not found; saving removes the expiry.
* **Tests.** API (ownership, validation, not found), component (confirmation).
* **Depends on.** SH-4 (`outfits`). New collections are added through Shreya's review and to `USER_OWNED_COLLECTIONS`.

### AN-4 — Feedback and alternatives on looks (#13)
* **Scope.** "Love it" / "not for me" with an optional reason (FR-OUT-04); request alternatives; feedback stored as a permitted preference signal that never overrides explicit profile choices (PDF p6).
* **Tests.** API and component tests; deletion with the account.

### AN-5 — Persistence, authorisation and UI tests
* **Scope.** Account deletion and tombstone replay cover saved looks and feedback; authorisation on every endpoint; responsive checks.

---

## Kedar

### KE-1 — Shop My Look filtering, budget engine and shortlist (#8, #14)
* **Problem / behaviour.** Stage 1 shopping uses items the user found themselves (D-77 = B).
* **Scope.** Budget engine as pure functions (FR-BUD); shortlist add, edit and remove (name, optional https link, entered price, optional note; D-80 limits); Shop My Look page with budget, category and size filters; "not verified by StyleMe" labels; StyleMe never fetches a link.
* **Out of scope.** Real products, retailer links from StyleMe, checkout, scraping.
* **Modules.** New shortlist contract, model (through Shreya's review and `USER_OWNED_COLLECTIONS`), service and routes; new route under `apps/web/app/(app)/`.
* **Acceptance.** FR-LIST, FR-BUD; totals correct; labels always shown.
* **Tests.** Budget unit tests; shortlist API (validation, https only, ownership, deletion); component tests.

### KE-2 — Product-data validation and disclosures (🔴 product layer)
* **Scope.** Only after a retailer authorises access: provenance validation (FR-PROD), disclosures (D-46), freshness (D-50), "data unavailable" states (PDF p17).
* **Approval.** D-43 … D-46, D-50, D-51, D-74.

### KE-3 — Integrate shopping with recommended and saved looks (#14)
* **Scope.** Attach shortlist items to a look slot (`{outfitId, slotId}`, one per slot); price summary on saved looks; "Shop this look" entry from Discover (JO-5).
* **Depends on.** SH-4, AN-3. **Tests.** Integration tests; removing a saved look keeps or detaches items as specified in FR-LIST.

### KE-4 — Design Studio (🔴 D-76)
* **Scope.** PDF p20 after the founder decides D-76; until then nothing beyond the "Coming soon" page.

### KE-5 — Virtual Try-On planning (🔴 D-48)
* **Scope.** A proposal only: consent, image handling, deletion, and the limits of AI rule 16 — for the founder's D-48 decision and a privacy review. No implementation.
